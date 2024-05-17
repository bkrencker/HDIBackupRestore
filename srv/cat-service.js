const cds = require('@sap/cds');

const { HDIContainers, Backups, Imports } = cds.entities('my');
const { uuid } = cds.utils;

const hana = require('@sap/hana-client');

/**
 * Setup AWS S3 Client
 * Credentials are read from Binding
 */
const s3Credentials = JSON.parse(process.env.VCAP_SERVICES).objectstore[0].credentials;
const { S3Client, GetObjectCommand, HeadBucketCommand, ListObjectsV2Command, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const s3 = new S3Client({
  region: s3Credentials.region,
  credentials: {
    accessKeyId: s3Credentials.access_key_id,
    secretAccessKey: s3Credentials.secret_access_key,
  }
});


class CatalogService extends cds.ApplicationService {
  init() {

    /**
     * Create and get a new Hana Database Connection for the BACKUP-User
     * @returns Hana Database Connection using @sap/hana-client
     */
    async function _getHanaConnection() {
      const conn = hana.createConnection();
      const conn_params = {
        serverNode: `${cds.requires.hanadb.credentials.host}`,
        uid: `${cds.requires.hanadb.credentials.user}`,
        pwd: `${cds.requires.hanadb.credentials.pw}`
      };

      await conn.connect(conn_params);
      return conn;
    };

    /**
     * Restore a HDI Backup from S3 Objectstore into a HDI Target Container
     * @param {*} req CAP Request Object
     * @param {String} targetContainer Target HDI Container GUID where Backup is restored to
     * @returns CAP Request Object
     */
    async function _restoreBackup(req, targetContainer) {
      const backup = await SELECT.one.from(req.subject, backup => {
        backup('*'),
          backup.hdiContainer('*')
      });

      console.log(`Restore Backup`, JSON.stringify(backup));

      if (!targetContainer) {
        targetContainer = backup.hdiContainer.containerId
      }

      const conn = await _getHanaConnection();

      const awsS3SourcePath = `s3-${s3Credentials.region}://${s3Credentials.access_key_id}:${s3Credentials.secret_access_key}@${s3Credentials.bucket}/${backup.path}`;

      await conn.exec('CREATE LOCAL TEMPORARY COLUMN TABLE #PARAMETERS LIKE _SYS_DI.TT_PARAMETERS;');
      await conn.exec(`INSERT INTO #PARAMETERS (KEY, VALUE) VALUES ('source_path', '${awsS3SourcePath}');`);
      await conn.exec(`INSERT INTO #PARAMETERS (KEY, VALUE) VALUES ('original_container_name', '${backup.hdiContainer.containerId}');`);
      const aImportResult = await conn.exec(`CALL _SYS_DI#BROKER_CG.IMPORT_CONTAINER_FOR_COPY('${targetContainer}', '', '', #PARAMETERS, ?, ?, ?);`);
      await conn.exec(`DROP TABLE #PARAMETERS;`);

      // Filter the array to keep the first two entries and all entries with severity "ERROR"
      let aNewImportLog = aImportResult.filter((entry, index) => {
        return index < 2 || (entry.SEVERITY === 'ERROR');
      });

      console.log('Result:', aNewImportLog);

      const errorMessages = aNewImportLog
        .filter(item => item.SEVERITY === 'ERROR')
        .map(item => item.MESSAGE);

      if (errorMessages.length > 0) {
        console.log('Error messages found', errorMessages);
        return req.error({
          code: 'EXPORT_ERROR',
          message: `Restore of HDI Container failed: \n${errorMessages.toString()}`,
          status: 418
        });
      }

      let newImportEntry = {
        ID: uuid(),
        backup_ID: backup.ID,
        importLogs: JSON.stringify(aNewImportLog),
        targetContainer_containerId: targetContainer
      };

      console.log('Insert New Backup Entry', newImportEntry);
      const insertResult = await INSERT(newImportEntry).into(Imports);

      conn.disconnect();

      return req.info("Backup was successfully imported");
    };

    /**
     * Create a new Backup and store it on AWS S3 Storage.
     * Note that the Backup is directly written from Hana DB to S3 store.
     */
    this.on('createBackup', async (req) => {
      // Check access to S3 Bucket
      const resp = await s3.send(new HeadBucketCommand({
        "Bucket": s3Credentials.bucket
      }));
      console.log('S3 Bucket', resp);

      console.log('Create Backup Action');
      console.log('req.data', JSON.stringify(req.data));
      console.log('req.params', JSON.stringify(req.params));

      const hdiContainer = await SELECT.one.from(req.subject, hdiContainer => {
        hdiContainer('*'),
          hdiContainer.application('*')
      });

      console.log(`Create Backup for HDI Container`, JSON.stringify(hdiContainer));

      if (!hdiContainer || hdiContainer.containerId.length === 0) {
        return req.error({
          code: 'NO_HDI_CONTAINER',
          message: 'HDI Container not found',
          status: 418
        });
      }

      const conn = await _getHanaConnection();
      const createdTimestamp = new Date();

      const applicationString = hdiContainer.application?.name?.length > 0 ? hdiContainer.application.name : hdiContainer.application_ID;
      const awsS3FolderPath = `${applicationString}/${hdiContainer.containerId}/${createdTimestamp.toISOString()}`;
      const awsS3TargetPath = `s3-${s3Credentials.region}://${s3Credentials.access_key_id}:${s3Credentials.secret_access_key}@${s3Credentials.bucket}/${awsS3FolderPath}`;

      console.log('Store Backup on S3 Path', awsS3FolderPath);

      await conn.exec('CREATE LOCAL TEMPORARY COLUMN TABLE #PARAMETERS LIKE _SYS_DI.TT_PARAMETERS;');
      await conn.exec(`INSERT INTO #PARAMETERS (KEY, VALUE) VALUES ('target_path', '${awsS3TargetPath}');`);
      const aExportResult = await conn.exec(`CALL _SYS_DI#BROKER_CG.EXPORT_CONTAINER_FOR_COPY('${hdiContainer.containerId}', '', '', #PARAMETERS, ?, ?, ?);`);
      await conn.exec(`DROP TABLE #PARAMETERS;`);

      console.log('Result:', aExportResult);

      const errorMessages = aExportResult
        .filter(item => item.SEVERITY === 'ERROR')
        .map(item => item.MESSAGE);

      if (errorMessages.length > 0) {
        console.log('Error messages found', errorMessages);
        return req.error({
          code: 'EXPORT_ERROR',
          message: `Export of HDI Container failed: \n${errorMessages.toString()}`,
          status: 418
        });
      }

      /**
       * Check if files are created on S3 storage.
       * Calculate Size of all Files and also the number of files (just for information).
       */
      const { Contents } = await s3.send(new ListObjectsV2Command({
        "Bucket": s3Credentials.bucket,
        "Prefix": awsS3FolderPath
      }));

      if (!Contents) {
        return req.error({
          code: 'EXPORT_ERROR',
          message: `Export not found on S3 Storage, check Export Log: \n${JSON.stringify(aExportResult)}`,
          status: 418
        });
      }

      let folderSize = 0;
      let numberOfFiles = 0;

      Contents.forEach(obj => {
        folderSize += obj.Size;
        numberOfFiles++;
      });

      console.log(`Backup containing ${numberOfFiles} Files that are created on S3 storage`);
  
      // Convert bytes to megabytes
      const folderSizeInMB = folderSize / (1024 * 1024);
      console.log(`Size of Backup is ${folderSizeInMB.toFixed(2)} MB`);

      let newBackupEntry = {
        ID: uuid(),
        created: createdTimestamp,
        hdiContainer_containerId: hdiContainer.containerId,
        path: awsS3FolderPath,
        exportLogs: JSON.stringify(aExportResult),
        numberOfFiles: numberOfFiles,
        sizeInMB : folderSizeInMB.toFixed(0)
      };

      console.log('Insert New Backup Entry', newBackupEntry);
      const insertResult = await INSERT(newBackupEntry).into(Backups);

      conn.disconnect();

      return req.info("Backup was successfully created");

    });

    /**
     * Restore (Import) an existing Backup from S3 store into the same HDI Container.
     * Note that all Data and Artifacts are overwritten in the target container!
     */
    this.on('restoreBackup', async (req) => {
      console.log('Restore Backup Action');
      console.log('req.data', JSON.stringify(req.data));
      console.log('req.params', JSON.stringify(req.params));

      return _restoreBackup(req);
    });

    /**
     * Restore (Import) an existing Backup from S3 store into another HDI Container.
     * Note that all Data and Artifacts are overwritten in the target container!
     */
    this.on('restoreBackupToOtherHDIContainer', async (req) => {
      console.log('Restore Backup Action');
      console.log('req.data', JSON.stringify(req.data));
      console.log('req.params', JSON.stringify(req.params));

      const { containerId, description } = req.data;
      console.log(`Restore to target HDI Container ID ${containerId} (${description})`);

      const backup = await SELECT.one.from(req.subject, backup => {
        backup('*'),
          backup.hdiContainer('*')
      });

      console.log(`Restore Backup`, JSON.stringify(backup));

      return _restoreBackup(req, containerId);
    });

    /**
     * This Event Handler is called when the DRAFT is deleted! At this point, delete the backup files on S3 storage.
     * Note that in CAP the draft can be cancelled, but the files on S3 are deleted anyways.
     */
    this.on('DELETE', Backups.drafts, async (req, next) => {
      console.log("On DELETE Backups");

      const backup = await SELECT.one.from(req.subject);
      console.log('Backup to Delete', backup);

      const { Contents } = await s3.send(new ListObjectsV2Command({ Bucket: s3Credentials.bucket, Prefix: backup.path }));

      if (!Contents) {
        // there are no files on S3, just delete the entity record in the DB
        return next(); // call default event handler
      }

      const deletePromises = Contents.map(async (obj) => {
        const deleteParams = {
          Bucket: s3Credentials.bucket,
          Key: obj.Key
        };
        await s3.send(new DeleteObjectCommand(deleteParams));
      });

      await Promise.all(deletePromises);

      console.log('All objects in the folder deleted successfully');
      return next(); // call default event handler
    });

    return super.init();
  }
};

module.exports = { CatalogService }
