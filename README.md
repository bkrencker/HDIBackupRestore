# Getting Started

Welcome to your new project.

It contains these folders and files, following our recommended project layout:

File or Folder | Purpose
---------|----------
`app/` | content for UI frontends goes here
`db/` | your domain models and data go here
`srv/` | your service models and code go here
`package.json` | project metadata and configuration
`readme.md` | this getting started guide

## Environment Variables

When running locally create .env File with following variables to connect with BACKUP User to the Hana DB Instance
cds.requires.hanadb.credentials.host=<Hana DB Connection String>
cds.requires.hanadb.credentials.user=<Hana DB Username>
cds.requires.hanadb.credentials.pw=<Hana DB Password>

## Next Steps

- Open a new terminal and run `cds watch`
- (in VS Code simply choose _**Terminal** > Run Task > cds watch_)
- Start adding content, for example, a [db/schema.cds](db/schema.cds).


## Learn More

Learn more at https://cap.cloud.sap/docs/get-started/.
