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

      const hdiContainer = await SELECT.one.from(req.subject);
      console.log(`Create Backup for HDI Container`, JSON.stringify(hdiContainer));

      if (!hdiContainer || hdiContainer.containerId.length === 0) {
        return req.error({
          code: 'NO_HDI_CONTAINER',
          message: 'HDI Container nicht gefunden',
          status: 418
        });
      }

      console.log('CDS ENV', cds.requires.hanadb);

      const conn = hana.createConnection();
      const conn_params = {
        serverNode: `${ cds.requires.hanadb.credentials.host }`,
        uid: `${ cds.requires.hanadb.credentials.user }`,
        pwd: `${ cds.requires.hanadb.credentials.pw }`
      };

      await conn.connect(conn_params);

      //conn.exec('SELECT Name, Description FROM Products WHERE id = ?', [301], function (err, result) {
      //const result = await conn.exec('select * from _sys_di.m_all_container_groups');

      const createdTimestamp = new Date();

      const awsS3Credentials = cds.requires.awss3.credentials;
      const awsS3TargetPath = `${awsS3Credentials.region}://${awsS3Credentials.access_key}:${awsS3Credentials.secret_key}@${awsS3Credentials.bucket_name}/${hdiContainer.containerId}/${createdTimestamp.toISOString()}`;


      await conn.exec('CREATE LOCAL TEMPORARY COLUMN TABLE #PARAMETERS LIKE _SYS_DI.TT_PARAMETERS;');
      await conn.exec(`INSERT INTO #PARAMETERS (KEY, VALUE) VALUES ('target_path', '${ awsS3TargetPath }');`);
      const copyResult = await conn.exec(`CALL _SYS_DI#BACKUP.EXPORT_CONTAINER_FOR_COPY('${ hdiContainer.containerId }', '', '', #PARAMETERS, ?, ?, ?);`);
      await conn.exec(`DROP TABLE #PARAMETERS;`);

      console.log('Result:', JSON.stringify(copyResult));

      let newBackupEntry = { 
        ID: uuid(), 
        created: createdTimestamp, 
        hdiContainer_ID: hdiContainer.ID, 
        IsActiveEntity: true, 
        exportLogs: JSON.stringify(copyResult) 
      };

      console.log('Insert New Backup Entry', newBackupEntry);

      const insertResult = await INSERT([newBackupEntry]).into(Backups);
      console.log('Insert Result', insertResult);

      conn.disconnect();

    });

    return super.init();
  }
};

module.exports = { CatalogService }
