using CatalogService as service from '../../srv/cat-service';
using from '../../db/schema';

// Child Compositions inherit DRAFT enablement
annotate service.Applications with @odata.draft.enabled;

// Disable DRAFT on Data that is created by ACTIONs on CAP Backend
//annotate service.Backups with @odata.draft.enabled: false;
//annotate service.Imports with @odata.draft.enabled: false;

annotate service.Applications with @(
    UI.LineItem : [
        {
            $Type : 'UI.DataField',
            Value : name,
            Label : 'name',
        },
    ]
);
annotate service.Applications with @(
    UI.Facets : [
        {
            $Type : 'UI.ReferenceFacet',
            Label : 'Application',
            ID : 'Application',
            Target : '@UI.FieldGroup#Application',
        },
        {
            $Type : 'UI.ReferenceFacet',
            Label : 'HDI Containers',
            ID : 'HDIContainers',
            Target : 'hdiContainers/@UI.LineItem#HDIContainers',
        },
    ],
    UI.FieldGroup #Application : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Value : name,
                Label : 'name',
            },],
    }
);
annotate service.Applications with @(
    UI.FieldGroup #HDIContainers : {
        $Type : 'UI.FieldGroupType',
        Data : [
        ],
    }
);
annotate service.Applications with @(
    UI.HeaderInfo : {
        Title : {
            $Type : 'UI.DataField',
            Value : name,
        },
        TypeName : 'Application',
        TypeNamePlural : 'Applications',
    }
);
annotate service.HDIContainers with @(
    UI.Facets : [
        {
            $Type : 'UI.ReferenceFacet',
            Label : 'HDI Container',
            ID : 'HDIContainer',
            Target : '@UI.FieldGroup#HDIContainer',
        },
        {
            $Type : 'UI.ReferenceFacet',
            Label : 'Backups',
            ID : 'Backups',
            Target : 'backups/@UI.LineItem#Backups',
        },
    ],
    UI.FieldGroup #HDIContainer : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataFieldForAction',
                Action : 'CatalogService.createBackup',
                Label : 'Create Backup',
            },
            {
                $Type : 'UI.DataField',
                Value : description,
                Label : 'description',
            },
            {
                $Type : 'UI.DataField',
                Value : containerId,
                Label : 'Container GUID',
            },
            {
                $Type : 'UI.DataField',
                Value : scheduled,
            },],
    }
);
annotate service.HDIContainers with @(
    UI.LineItem #HDIContainers : [
        {
            $Type : 'UI.DataField',
            Value : description,
            Label : 'description',
        },
        {
            $Type : 'UI.DataFieldForAction',
            Action : 'CatalogService.createBackup',
            Label : 'Create Backup',
        },
        {
            $Type : 'UI.DataField',
            Value : containerId,
            Label : 'Container GUID',
        },
        {
            $Type : 'UI.DataField',
            Value : scheduled,
            Label : 'Scheduled?',
        },]
);
annotate service.HDIContainers with @(
    UI.HeaderInfo : {
        TypeName : 'HDI Container',
        TypeNamePlural : 'HDI Containers',
        Title : {
            $Type : 'UI.DataField',
            Value : description,
        },
    }
);
annotate service.Backups with @(
    UI.HeaderInfo : {
        TypeName : 'Backup',
        TypeNamePlural : 'Backups',
        Title : {
            $Type : 'UI.DataField',
            Value : createdAt,
        },
    }
);
annotate service.Backups with @(
    UI.Facets : [
        {
            $Type : 'UI.ReferenceFacet',
            Label : 'Backup',
            ID : 'Backup',
            Target : '@UI.FieldGroup#Backup',
        },
        {
            $Type : 'UI.ReferenceFacet',
            Label : 'Logs',
            ID : 'Logs',
            Target : '@UI.FieldGroup#Logs',
        },
        {
            $Type : 'UI.ReferenceFacet',
            Label : 'Restores',
            ID : 'Restores',
            Target : 'imports/@UI.LineItem#Restores',
        },
    ],
    UI.FieldGroup #Backup : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Value : description,
            },
            {
                $Type : 'UI.DataField',
                Value : createdBy,
            },
            {
                $Type : 'UI.DataField',
                Value : created,
                Label : 'Created Timestamp',
            },{
                $Type : 'UI.DataField',
                Value : path,
                Label : 'S3 Path (Key)',
            },
            {
                $Type : 'UI.DataField',
                Value : numberOfFiles,
            },
            {
                $Type : 'UI.DataField',
                Value : sizeInMB,
            },
            {
                $Type : 'UI.DataField',
                Value : fromScheduler,
            },],
    }
);
annotate service.Imports with @(
    UI.LineItem #Restores : [
        {
            $Type : 'UI.DataField',
            Value : createdAt,
        },{
            $Type : 'UI.DataField',
            Value : createdBy,
        },
        {
            $Type : 'UI.DataField',
            Value : description,
            Label : 'Description',
        },]
);
annotate service.Backups with @(
    UI.LineItem #Backups : [
        {
            $Type : 'UI.DataFieldForAction',
            Action : 'CatalogService.restoreBackup',
            Label : 'Restore Backup',
        },
        {
            $Type : 'UI.DataField',
            Value : created,
            Label : 'Created',
        },
        {
            $Type : 'UI.DataField',
            Value : createdBy,
        },
        {
            $Type : 'UI.DataField',
            Value : description,
        },
        {
            $Type : 'UI.DataField',
            Value : numberOfFiles,
            Label : 'Files',
        },
        {
            $Type : 'UI.DataField',
            Value : sizeInMB,
            Label : 'MB',
        },
        {
            $Type : 'UI.DataField',
            Value : fromScheduler,
            Label : 'Scheduler?',
        },]
);
annotate service.Backups with @(
    UI.FieldGroup #Logs : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Value : exportLogs,
                Label : 'Backup Log',
            },],
    }
);
annotate service.Backups with {
    exportLogs @UI.MultiLineText : true
};
annotate service.Backups with @(
    UI.UpdateHidden : true,
    UI.CreateHidden : true
);
annotate service.Imports with @(
    UI.UpdateHidden : true
);
annotate service.Imports with @(
    UI.DeleteHidden : true
);

annotate service.Backups with @(
    UI.Identification : [
        {
            $Type : 'UI.DataFieldForAction',
            Action : 'CatalogService.restoreBackup',
            Label : 'Restore Backup',
        },
        {
            $Type : 'UI.DataFieldForAction',
            Action : 'CatalogService.restoreBackupToOtherHDIContainer',
            Label : 'Restore to other HDI Container',
        },
    ]
);
annotate service.Imports with @(
    UI.Facets : [
        {
            $Type : 'UI.ReferenceFacet',
            Label : 'Restore Information',
            ID : 'RestoreInformation',
            Target : '@UI.FieldGroup#RestoreInformation',
        },
        {
            $Type : 'UI.ReferenceFacet',
            Label : 'Restored to HDI Container (Target Container)',
            ID : 'RestoredtoHDIContainerTargetContainer',
            Target : '@UI.FieldGroup#RestoredtoHDIContainerTargetContainer',
        },
    ],
    UI.FieldGroup #RestoreInformation : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Value : createdBy,
            },{
                $Type : 'UI.DataField',
                Value : createdAt,
            },
            {
                $Type : 'UI.DataField',
                Value : description,
            },{
                $Type : 'UI.DataField',
                Value : importLogs,
                Label : 'Restore Logs',
            },],
    }
);
annotate service.Imports with {
    importLogs @UI.MultiLineText : true
};
annotate service.Imports with @(
    UI.FieldGroup #RestoredtoHDIContainerTargetContainer : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Value : targetContainer.containerId,
            },{
                $Type : 'UI.DataField',
                Value : targetContainer.description,
                Label : 'Description',
            },{
                $Type : 'UI.DataField',
                Value : targetContainer.application.name,
                Label : 'Application',
            },],
    }
);
annotate service.Backups with {
    fromScheduler @Common.FieldControl : #ReadOnly
};
