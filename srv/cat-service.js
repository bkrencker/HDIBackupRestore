const cds = require('@sap/cds');
const { HDIContainers, Backups } = cds.entities('my');
const { uuid } = cds.utils;

const hana = require('@sap/hana-client');

class CatalogService extends cds.ApplicationService {
  init() {

    this.on('createBackup', async (req) => {
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

      const conn = hana.createConnection();
      const conn_params = {
        serverNode: `${ cds.requires.hanadb.credentials.host }`,
        uid: `${ cds.requires.hanadb.credentials.user }`,
        pwd: `${ cds.requires.hanadb.credentials.pw }`
      };

      await conn.connect(conn_params);

      const createdTimestamp = new Date();

      const awsS3Credentials = cds.requires.awss3.credentials;
      const applicationString = hdiContainer.application?.name?.length > 0 ? hdiContainer.application.name : hdiContainer.application_ID;
      const awsS3FolderPath = `${applicationString}/${hdiContainer.containerId}/${createdTimestamp.toISOString()}`;
      const awsS3TargetPath = `${awsS3Credentials.region}://${awsS3Credentials.access_key}:${awsS3Credentials.secret_key}@${awsS3Credentials.bucket_name}/${awsS3FolderPath}`;

      console.log('Store Backup on S3 Path', awsS3FolderPath);

      await conn.exec('CREATE LOCAL TEMPORARY COLUMN TABLE #PARAMETERS LIKE _SYS_DI.TT_PARAMETERS;');
      await conn.exec(`INSERT INTO #PARAMETERS (KEY, VALUE) VALUES ('target_path', '${ awsS3TargetPath }');`);
      const copyResult = await conn.exec(`CALL _SYS_DI#BACKUP.EXPORT_CONTAINER_FOR_COPY('${ hdiContainer.containerId }', '', '', #PARAMETERS, ?, ?, ?);`);
      await conn.exec(`DROP TABLE #PARAMETERS;`);

      console.log('Result:', JSON.stringify(copyResult));

      let newBackupEntry = { 
        ID: uuid(), 
        created: createdTimestamp, 
        hdiContainer_ID: hdiContainer.ID, 
        path: awsS3FolderPath,
        IsActiveEntity: true, 
        exportLogs: JSON.stringify(copyResult) 
      };

      console.log('Insert New Backup Entry', newBackupEntry);

      const insertResult = await INSERT(newBackupEntry).into(Backups);

      conn.disconnect();

      return req.info("Backup was successfully created");

    });

    return super.init();
  }
};

module.exports = { CatalogService }
