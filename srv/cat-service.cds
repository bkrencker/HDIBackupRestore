using { my } from '../db/schema';

@requires: 'authenticated-user'
service CatalogService {

  entity Applications as projection on my.Applications;

  entity HDIContainers as projection on my.HDIContainers actions {
    action createBackup();
  };

  entity Backups as projection on my.Backups actions {
    action deleteBackup();
    action restoreBackup();
  };
}
