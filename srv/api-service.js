const cds = require('@sap/cds');
const crypto = require('crypto');

const { HDIContainers, Backups } = cds.entities('my');
const { uuid } = cds.utils;

const CatalogService = require('./cat-service');

const LOG = cds.log('custom');

const DEFAULT_MIN_BACKUP_INTERVAL_MINUTES = 5;

/**
 * Minimum time that has to pass between two backups of the same HDI Container.
 * Configurable via the MIN_BACKUP_INTERVAL_MINUTES environment variable.
 */
const MIN_BACKUP_INTERVAL_MINUTES = Number(process.env.MIN_BACKUP_INTERVAL_MINUTES) || DEFAULT_MIN_BACKUP_INTERVAL_MINUTES;
const MIN_BACKUP_INTERVAL_MS = MIN_BACKUP_INTERVAL_MINUTES * 60 * 1000;

/**
 * Backups that are currently running, keyed by HDI Container GUID.
 * Needed because the Backups entry is only written once the export has finished,
 * so the database check alone cannot detect a backup that is still in progress.
 * Only effective per application instance.
 */
const runningBackups = new Map();

/**
 * Compare the provided API key against the expected one without leaking timing information.
 * Both values are hashed first so that the comparison is independent of the key length.
 * @param {String} providedApiKey API key sent by the caller
 * @param {String} expectedApiKey API key configured for this application
 * @returns {Boolean} TRUE if both keys match
 */
function _isValidApiKey(providedApiKey, expectedApiKey) {
  const provided = crypto.createHash('sha256').update(providedApiKey).digest();
  const expected = crypto.createHash('sha256').update(expectedApiKey).digest();

  return crypto.timingSafeEqual(provided, expected);
}

class ApiService extends cds.ApplicationService {
  init() {

    /**
     * This service is reachable without authentication, so every request has to present the API key.
     */
    this.before('*', (req) => {
      const expectedApiKey = process.env.BACKUP_API_KEY;

      if (!expectedApiKey) {
        LOG.error('BACKUP_API_KEY is not configured, rejecting external API request');
        return req.reject(503, 'External API is not configured');
      }

      const providedApiKey = req.headers['x-api-key'];

      if (!providedApiKey || !_isValidApiKey(providedApiKey, expectedApiKey)) {
        LOG.warn('External API request rejected because of a missing or invalid API key');
        return req.reject(401, 'Invalid API key');
      }
    });

    /**
     * Create a Backup of a single HDI Container.
     * The backup itself runs in the background, the returned backupId can be polled via backupStatus.
     */
    this.on('createBackup', async (req) => {
      /**
       * Make sure HDI container exists and is valid
       */
      const { containerId } = req.data;
      LOG.debug('Create Backup by External API', containerId);

      if (!containerId) {
        return req.reject(400, 'Parameter containerId is required');
      }

      const hdiContainer = await SELECT.one.from(HDIContainers, hdiContainer => {
        hdiContainer('*'),
          hdiContainer.application('*')
      }).where({ containerId });

      if (!hdiContainer) {
        return req.reject(404, `HDI Container ${containerId} not found`);
      }

      /**
       * Prevent starting a backup if one is already running for the same HDI Container or if the last backup was created too recently.
       * The time between two backups is configurable via the MIN_BACKUP_INTERVAL_MINUTES environment variable, defaulting to 5 minutes.
       */
      const runningSince = runningBackups.get(containerId);
      if (runningSince) {
        return req.reject(429, `A backup for HDI Container ${containerId} has already been running since ${runningSince.toISOString()}`);
      }

      const lastBackup = await SELECT.one.from(Backups)
        .where({ hdiContainer_containerId: containerId })
        .orderBy('created desc');

      if (lastBackup?.created) {
        const msSinceLastBackup = Date.now() - new Date(lastBackup.created).getTime();

        if (msSinceLastBackup < MIN_BACKUP_INTERVAL_MS) {
          const retryAfterSeconds = Math.ceil((MIN_BACKUP_INTERVAL_MS - msSinceLastBackup) / 1000);
          return req.reject(429, `Last backup for HDI Container ${containerId} was created less than ${MIN_BACKUP_INTERVAL_MINUTES} minutes ago, retry in ${retryAfterSeconds} seconds`);
        }
      }
      
      /**
       * Check if the S3 Bucket is available before starting the backup, otherwise the backup will fail anyway.
       */
      await CatalogService._checkS3Bucket();
      LOG.debug('S3 Bucket is available');

      const backupId = uuid();
      runningBackups.set(containerId, new Date());

      /**
       * A backup takes far longer than the usual HTTP timeouts, so it is processed in the background.
       * The caller polls the result via the backupStatus function using the returned backupId.
       */
      cds.spawn(async () => {
        try {
          // _createBackup reports failures via req.error instead of throwing, so compare the result
          const result = await CatalogService._createBackup(hdiContainer, req, false, backupId);

          if (result === backupId) {
            LOG.info(`Backup ${backupId} for HDI Container ${containerId} created successfully`);
          } else {
            LOG.error(`Backup ${backupId} for HDI Container ${containerId} failed`, req.errors);
          }
        } catch (err) {
          LOG.error(`Backup ${backupId} for HDI Container ${containerId} failed`, err);
        } finally {
          runningBackups.delete(containerId);
        }
      });

      let { res } = req.http;
      res.status(202).json({
        backupId: backupId,
        message: 'Backup started, poll backupStatus with the returned backupId'
      });
    });

    /**
     * Get the status of a Backup that was triggered via this API.
     * The Backups entry is only written once the export has finished, so a missing entry
     * means that the backup is either still running or has failed.
     */
    this.on('backupStatus', async (req) => {
      const { backupId } = req.data;
      LOG.debug('Get Backup Status by External API', backupId);

      if (!backupId) {
        return req.reject(400, 'Parameter backupId is required');
      }

      const backup = await SELECT.one.from(Backups).where({ ID: backupId });

      if (!backup) {
        return {
          backupId: backupId,
          status: 'pending'
        };
      }

      return {
        backupId: backup.ID,
        status: 'completed',
        created: backup.created,
        path: backup.path,
        numberOfFiles: backup.numberOfFiles,
        sizeInMB: backup.sizeInMB
      };
    });

    return super.init();
  }
};

module.exports = { ApiService }
