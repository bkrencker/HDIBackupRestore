const cds = require('@sap/cds');

const { HDIContainers } = cds.entities('my');

const CatalogService = require('./cat-service');



class SchedulerService extends cds.ApplicationService {
  init() {

    /**
     * 
     * Test with HTTP GET http://localhost:4004/odata/v4/scheduler/createBackups()
     */
    this.on('createBackups', async (req) => {
      console.log('Create Backup by Scheduler Function');
      console.log('req.data', JSON.stringify(req.data));
      console.log('req.params', JSON.stringify(req.params));

      const hdiContainers = await SELECT.from(HDIContainers, hdiContainer => {
        hdiContainer('*'),
          hdiContainer.application('*')
      });

      console.log('HDI Containers', hdiContainers);

      await CatalogService._checkS3Bucket();

      for (let hdiContainer of hdiContainers) {
        await CatalogService._createBackup(hdiContainer, req, true);
      }

      return ['OK'];
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


    return super.init();
  }
};

module.exports = { SchedulerService }
