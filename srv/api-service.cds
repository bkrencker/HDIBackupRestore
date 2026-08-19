/**
 * Public REST API to trigger backups from external systems.
 * Not protected by XSUAA, but requires the API key from the BACKUP_API_KEY environment variable
 * to be sent in the 'x-api-key' request header.
 */
@path    : '/api/v1'
@protocol: 'rest'
@requires: 'any'
service ApiService {

  /**
   * Test with POST http://localhost:4004/api/v1/createBackup
   * Header: x-api-key: <BACKUP_API_KEY>
   * Body: { "containerId": "<HDI Container GUID>" }
   */
  action createBackup(containerId : String) returns {
    backupId : String;
    message  : String;
  };

  /**
   * Test with GET http://localhost:4004/api/v1/backupStatus?backupId=<ID>
   * Header: x-api-key: <BACKUP_API_KEY>
   */
  function backupStatus(backupId : String) returns {
    backupId      : String;
    status        : String;
    created       : DateTime;
    path          : String;
    numberOfFiles : Integer;
    sizeInMB      : Integer;
  };
}
