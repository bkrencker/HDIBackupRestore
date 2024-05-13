using CatalogService as service from '../../srv/cat-service';
using from '../../db/schema';

annotate service.Applications with @odata.draft.enabled;

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
                Value : createdAt,
            },{
                $Type : 'UI.DataField',
                Value : createdBy,
            },{
                $Type : 'UI.DataField',
                Value : path,
                Label : 'path',
            },
            {
                $Type : 'UI.DataFieldForAction',
                Action : 'CatalogService.deleteBackup',
                Label : 'deleteBackup',
            },
            {
                $Type : 'UI.DataFieldForAction',
                Action : 'CatalogService.restoreBackup',
                Label : 'restoreBackup',
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
        },]
);
annotate service.Backups with @(
    UI.LineItem #Backups : [
        {
            $Type : 'UI.DataFieldForAction',
            Action : 'CatalogService.deleteBackup',
            Label : 'Delete Backup',
        },{
            $Type : 'UI.DataFieldForAction',
            Action : 'CatalogService.restoreBackup',
            Label : 'Restore Backup',
        },
        {
            $Type : 'UI.DataField',
            Value : createdAt,
        },
        {
            $Type : 'UI.DataField',
            Value : createdBy,
        },]
);