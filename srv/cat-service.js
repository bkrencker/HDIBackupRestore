const cds = require('@sap/cds');

const { HDIContainers, Backups, Imports } = cds.entities('my');
const { uuid } = cds.utils;



const hana = require('@sap/hana-client');

// 
/**
 * https://github.com/cap-js/attachments/blob/main/lib/aws-s3.js
 * https://community.sap.com/t5/technology-blogs-by-members/working-with-files-in-cap-and-amazon-s3/ba-p/13427432
 */
const s3Credentials = JSON.parse(process.env.VCAP_SERVICES).objectstore[0].credentials;
const { S3Client, GetObjectCommand, HeadBucketCommand, ListObjectsV2Command } = require("@aws-sdk/client-s3");
const s3 = new S3Client({
  region: s3Credentials.region,
  credentials: {
    accessKeyId: s3Credentials.access_key_id,
    secretAccessKey: s3Credentials.secret_access_key,
  }
});

class CatalogService extends cds.ApplicationService {
  init() {

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

    this.on('createBackup', async (req) => {
      /**
       * Check access to S3 Bucket
       */
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
      const aExportResult = await conn.exec(`CALL _SYS_DI#BACKUP.EXPORT_CONTAINER_FOR_COPY('${hdiContainer.containerId}', '', '', #PARAMETERS, ?, ?, ?);`);
      await conn.exec(`DROP TABLE #PARAMETERS;`);

      console.log('Result:', aExportResult);

      const errorMessages = aExportResult
        .filter(item => item.SEVERITY === 'ERROR')
        .map(item => item.MESSAGE);

      if (errorMessages.length > 0) {
        console.log('Error messages found', errorMessages);
        return req.error({
          code: 'EXPORT_ERROR',
          message: `Export of HDI Container failed: \n${ errorMessages.toString() }`,
          status: 418
        });
      }

      /**
       * Check if files are created on S3 storage
       * Use arbitrary minimum number of 30 files
       */
      const resp1 = await s3.send(new ListObjectsV2Command({
        "Bucket": s3Credentials.bucket,
        "Prefix": awsS3FolderPath
      }));

      const aFiles = resp1.Contents.map(item => item.Key);
      console.log(`Backup containing ${ aFiles.length } Files that are created on S3 storage`);

      if (aFiles.length < 30) {
        return req.error({
          code: 'EXPORT_ERROR',
          message: `Export not found on S3 Storage, check Export Log: \n${ JSON.stringify(aExportResult) }`,
          status: 418
        });
      }

      let newBackupEntry = {
        ID: uuid(),
        created: createdTimestamp,
        hdiContainer_containerId: hdiContainer.containerId,
        path: awsS3FolderPath,
        exportLogs: JSON.stringify(aExportResult),
        numberOfFiles: aFiles.length
      };

      console.log('Insert New Backup Entry', newBackupEntry);
      const insertResult = await INSERT(newBackupEntry).into(Backups);

      conn.disconnect();

      return req.info("Backup was successfully created");

    });

    this.on('restoreBackup', async (req) => {
      console.log('Restore Backup Action');
      console.log('req.data', JSON.stringify(req.data));
      console.log('req.params', JSON.stringify(req.params));

      return _restoreBackup(req);

    });

    this.on('restoreBackupToOtherHDIContainer', async (req) => {
      console.log('Restore Backup Action');
      console.log('req.data', JSON.stringify(req.data));
      console.log('req.params', JSON.stringify(req.params));

      const { containerId, description } = req.data;
      console.log(`Restore to target HDI Container ID ${ containerId } (${ description })`);

      const backup = await SELECT.one.from(req.subject, backup => {
        backup('*'),
          backup.hdiContainer('*')
      });

      console.log(`Restore Backup`, JSON.stringify(backup));

      return _restoreBackup(req, containerId);
    });



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
      const aImportResult = await conn.exec(`CALL _SYS_DI#BACKUP.IMPORT_CONTAINER_FOR_COPY('${targetContainer}', '', '', #PARAMETERS, ?, ?, ?);`);
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
        message: `Restore of HDI Container failed: \n${ errorMessages.toString() }`,
        status: 418
      });
    }

      let newImportEntry = {
        ID: uuid(),
        backup_ID: backup.ID,
        importLogs: JSON.stringify(aNewImportLog)
      };

      console.log('Insert New Backup Entry', newImportEntry);
      const insertResult = await INSERT(newImportEntry).into(Imports);

      conn.disconnect();

      return req.info("Backup was successfully imported");
    };



    return super.init();
  }
};

module.exports = { CatalogService }
