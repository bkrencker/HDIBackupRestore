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
    // Refresh UI after action is performed
    @(
        Common.IsActionCritical: true,
        Common.SideEffects : {
          $Type : 'Common.SideEffectsType',
          TargetEntities : [
              in.imports
          ],
      }
    )
    action restoreBackup();

    @(
        Common.IsActionCritical: true,
        Common.SideEffects : {
          $Type : 'Common.SideEffectsType',
          TargetEntities : [
              in.imports
          ],
      }
    )
    action restoreBackupToOtherHDIContainer(
      @(
          mandatory,
          Common: {
            ValueListWithFixedValues,
            ValueList : {
                $Type : 'Common.ValueListType',
                CollectionPath : 'HDIContainers',
                Parameters : [
                    {
                        $Type : 'Common.ValueListParameterInOut',
                        LocalDataProperty : containerId,
                        ValueListProperty : 'containerId',
                    },
                    {
                        $Type : 'Common.ValueListParameterOut',
                        LocalDataProperty : description,
                        ValueListProperty : 'description',
                    },
                    {
                        $Type : 'Common.ValueListParameterOut',
                        LocalDataProperty : application,
                        ValueListProperty : 'application/name' 
                    },
                ],
            },
          }
      ) containerId : String @title: 'HDI Container GUID',
      @readonly description: String @title: 'HDI Container Description',
      @readonly application: String @title: 'Application Name'
    );

    @(
        Common.IsActionCritical: true,
        Common.SideEffects : {
          $Type : 'Common.SideEffectsType',
          TargetEntities : [
              in
          ],
      }
    )
    action deleteBackup();
  };
}
