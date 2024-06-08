/**
 * See https://community.sap.com/t5/technology-blogs-by-sap/sap-job-scheduling-service-cloud-application-programming-model-application/ba-p/13571175
 */
@(requires: ['authenticated-user', 'jobscheduler'])
service SchedulerService {

  /**
   * Test with GET http://localhost:4004/odata/v4/scheduler/createBackups()
   */
  function createBackups() returns String;
}
