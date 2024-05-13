const cds = require('@sap/cds')
const { Books, HDIContainers } = cds.entities('sap.capire.bookshop');

class CatalogService extends cds.ApplicationService {
  init() {

    this.on('createBackup', async (req) => {
      console.log('Create Backup Action');
      console.log('req.data', JSON.stringify(req.data));
      console.log('req.params', JSON.stringify(req.params));

      const { containerId } = await SELECT.one.from(req.subject);
      if (!containerId || containerId.length === 0) {
        return req.error ({
          code: 'NO_HDI_CONTAINER',
          message: 'HDI Container nicht gefunden',
          status: 418
        });
      }

      console.log(`Create Backup for HDI Container`, containerId);

    });

    return super.init();
  }
};

module.exports = { CatalogService }
