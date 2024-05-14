using { my } from '../db/schema';

@requires: 'authenticated-user'
service CatalogService {

  entity Applications as projection on my.Applications;

  entity HDIContainers as projection on my.HDIContainers actions {
    @Core.OperationAvailable: in.IsActiveEntity // Path is correct
    // Refresh UI after action is performed
    @Common.SideEffects : {
        $Type : 'Common.SideEffectsType',
        TargetEntities : [
            in.backups
        ],
    }
    action createBackup();
  };

  entity Backups as projection on my.Backups actions {
    @Core.OperationAvailable: in.IsActiveEntity // Path is correct
    action deleteBackup();

    @Core.OperationAvailable: in.IsActiveEntity // Path is correct
    action restoreBackup();
  };
}
