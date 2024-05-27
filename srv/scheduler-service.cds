using {my} from '../db/schema';

//@requires: 'any'  // public access !!
service SchedulerService {

  /**
   * Test with GET http://localhost:4004/odata/v4/scheduler/createBackups(apiKey=1234567890)
   */
  function createBackups( apiKey : Integer ) returns array of String;

}
