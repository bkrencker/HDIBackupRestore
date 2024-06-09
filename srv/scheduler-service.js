const cds = require('@sap/cds');
const axios = require('axios');

const { HDIContainers } = cds.entities('my');

const CatalogService = require('./cat-service');
const { request } = require('express');

const LOG = cds.log('cds');

async function _createBackupsInParallel(hdiContainers, req) {
  const backupPromises = hdiContainers.map(hdiContainer =>
    CatalogService._createBackup(hdiContainer, req, true)
  );

  // Wait for all backups to complete
  await Promise.all(backupPromises);
};

class SchedulerService extends cds.ApplicationService {
  init() {

    /**
     * Test with GET http://localhost:4004/odata/v4/scheduler/createBackups(apiKey=1234567890)
     */
    this.on('createBackups', async (req) => {
      LOG.debug('Create Backup by Scheduler Function');
      LOG.debug('req.data', JSON.stringify(req.data));
      LOG.debug('req.params', JSON.stringify(req.params));

      LOG.debug('Request headers', req.headers);

      /**
       * Store scheduler data in order to send asynchronous reponse later when background job (backups) has finished
       */
      const schedulerJobId = req.headers['x-sap-job-id'];
      const schedulerScheduleId = req.headers['x-sap-job-schedule-id'];
      const schedulerRunId = req.headers['x-sap-job-run-id'];
      const schedulerHost = req.headers['x-sap-scheduler-host'];

      const btpSchedulerCredentials = JSON.parse(process.env.VCAP_SERVICES).jobscheduler[0].credentials;
      const authString = Buffer.from(`${btpSchedulerCredentials.uaa.clientid}:${btpSchedulerCredentials.uaa.clientsecret}`).toString('base64');

      /**
       * Now get all HDI Containers which have the scheduler-flag set to 'true'
       */
      const hdiContainers = await SELECT.from(HDIContainers, hdiContainer => {
        hdiContainer('*'),
          hdiContainer.application('*')
      }).where({ scheduled: true });

      await CatalogService._checkS3Bucket();
      LOG.debug('S3 Bucket is available');

      /**
       * BTP Scheduler Timeout after 15 seconds.. Therefore process request in background and send an async response to the BTP Scheduler.
       * See https://community.sap.com/t5/technology-blogs-by-sap/using-job-scheduler-in-sap-cloud-platform-5-long-running-async-jobs/ba-p/13451049
       */
      cds.spawn(async () => {
        LOG.debug("CDS Spawn");

        // Get access token for BTP Scheduler instance
        const response = await axios.get(`${btpSchedulerCredentials.uaa.url}/oauth/token?grant_type=client_credentials&response_type=token`, {
          headers: {
            'Authorization': `Basic ${authString}`
          }
        });

        const token = response.data.access_token;

        const axiosConfig = {
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token
          }
        };

        const schedulerUrl = `${schedulerHost}/scheduler/jobs/${schedulerJobId}/schedules/${schedulerScheduleId}/runs/${schedulerRunId}`;

        _createBackupsInParallel(hdiContainers, req)
          .then(() => {
            LOG.debug('All backups created successfully');
            // Async response to scheduler instance
            axios.put(schedulerUrl, JSON.stringify({success: true, message: `Backups created for ${JSON.stringify(hdiContainers)}`}), axiosConfig);
          })
          .catch(err => {
            console.error('Error creating backups:', err);
            // Async response to scheduler instance
            axios.put(schedulerUrl, JSON.stringify({success: false, message: JSON.stringify(err)}), axiosConfig);
          });

      });

      /**
       * Async Scheduler should receive HTTP Status 202 to show proper status "RUNNING/ACK_RECVD".
       * When background job has finished, a final status will be sent asynchronously.
       */
      let { res } = req.http;
      res.status(202).send('Accepted async job, but long-running operation still running.');
    });

    /**
     * Restore (Import) an existing Backup from S3 store into another HDI Container.
     * Note that all Data and Artifacts are overwritten in the target container!
     */
    this.on('restoreBackupToOtherHDIContainer', async (req) => {
      LOG.debug('Restore Backup Action');
      LOG.debug('req.data', JSON.stringify(req.data));
      LOG.debug('req.params', JSON.stringify(req.params));

      const { containerId, description } = req.data;
      LOG.debug(`Restore to target HDI Container ID ${containerId} (${description})`);

      const backup = await SELECT.one.from(req.subject, backup => {
        backup('*'),
          backup.hdiContainer('*')
      });

      LOG.debug(`Restore Backup`, JSON.stringify(backup));

      return _restoreBackup(req, containerId);
    });


    return super.init();
  }
};

module.exports = { SchedulerService }
