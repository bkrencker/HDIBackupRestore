using { managed, cuid } from '@sap/cds/common';
namespace my;

entity Applications: cuid, managed {
  name          : String @mandatory;

  hdiContainers : Composition of many HDIContainers on hdiContainers.application = $self;
}

entity HDIContainers: cuid, managed {
  containerId  : String @mandatory;
  description  : String @mandatory;

  application  : Association to one Applications;
  backups      : Composition of many Backups on backups.hdiContainer = $self;
}

entity Backups: cuid, managed {
  created      : DateTime;
  path         : String;

  exportLogs   : String;

  hdiContainer : Association to one HDIContainers;
  imports      : Composition of many Imports on imports.backup = $self;
}

entity Imports: cuid, managed {
  importLogs : String;
  backup     : Association to one Backups;
}