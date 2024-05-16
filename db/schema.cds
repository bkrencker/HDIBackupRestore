using { managed, cuid } from '@sap/cds/common';
namespace my;

entity Applications: cuid, managed {
  name          : String @mandatory;

  hdiContainers : Composition of many HDIContainers on hdiContainers.application = $self;
}

@cds.odata.valuelist
entity HDIContainers: managed {
  key containerId  : String @assert.format : '[0-9A-Z]{32}' @title: 'HDI Container GUID (32 Characters)';
      description  : String @mandatory;

      application  : Association to one Applications;
      backups      : Composition of many Backups on backups.hdiContainer = $self;
}

entity Backups: cuid, managed {
  created       : DateTime @Core.Immutable;
  path          : String @Core.Immutable;
  exportLogs    : String @Core.Immutable;
  numberOfFiles : Integer @title: 'Number of Files';
  sizeInMB      : Integer @title: 'Size in MB';

  hdiContainer  : Association to one HDIContainers;
  imports       : Composition of many Imports on imports.backup = $self;
}

entity Imports: cuid, managed {
  importLogs : String;
  backup     : Association to one Backups;
}