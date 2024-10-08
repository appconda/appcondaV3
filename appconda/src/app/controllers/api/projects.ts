import { Document, ID, Permission, Role, Text, URLValidator, WhiteList } from "../../../Tuval/Core";
import { App } from "../../../Tuval/Http";
import { AppcondaException as Exception } from "../../../Appconda/Extend/Exception";
import { APP_AUTH_TYPE_ADMIN, APP_LIMIT_USER_SESSIONS_DEFAULT, APP_VERSION_STABLE } from "../../init";
import { Response } from "../../../Appconda/Tuval/Response";
import { ProjectId } from "../../../Appconda/Database/Validators/ProjectId";
import { Database, Duplicate, UID } from "../../../Tuval/Database";
import { Config } from "../../../Tuval/Config";
import { Connection, Group } from "../../../Tuval/Pools";
import { Hooks } from "../../../Appconda/Hooks/Hooks";
import { Auth } from "../../../Tuval/Auth";
import { DSN } from "../../../Tuval/DSN";
import { Cache } from "../../../Tuval/Cache";
import { Audit } from "../../../Tuval/Audit";
import { TimeLimit } from "../../../Tuval/Abuse/Adapters/Database/TimeLimit";

App.init()
    .groups(['projects'])
    .inject('project')
    .action((project: Document) => {
        if (project.getId() !== 'console') {
            throw new Exception(Exception.GENERAL_ACCESS_FORBIDDEN);
        }
    });

    App.post('/v1/projects')
    .desc('Create project')
    .groups(['api', 'projects'])
    .label('audits.event', 'projects.create')
    .label('scope', 'projects.write')
    .label('sdk.auth', [APP_AUTH_TYPE_ADMIN])
    .label('sdk.namespace', 'projects')
    .label('sdk.method', 'create')
    .label('sdk.response.code', Response.STATUS_CODE_CREATED)
    .label('sdk.response.type', Response.CONTENT_TYPE_JSON)
    .label('sdk.response.model', Response.MODEL_PROJECT)
    .param('projectId', '', new ProjectId(), 'Unique Id. Choose a custom ID or generate a random ID with `ID.unique()`. Valid chars are a-z, and hyphen. Can\'t start with a special char. Max length is 36 chars.')
    .param('name', null, new Text(128), 'Project name. Max length: 128 chars.')
    .param('teamId', '', new UID(), 'Team unique ID.')
    .param('region', process.env._APP_REGION || 'default', new WhiteList(Object.keys(Config.getParam('regions')).filter(key => !Config.getParam('regions')[key].disabled)), 'Project Region.', true)
    .param('description', '', new Text(256), 'Project description. Max length: 256 chars.', true)
    .param('logo', '', new Text(1024), 'Project logo.', true)
    .param('url', '', new URLValidator(), 'Project URL.', true)
    .param('legalName', '', new Text(256), 'Project legal Name. Max length: 256 chars.', true)
    .param('legalCountry', '', new Text(256), 'Project legal Country. Max length: 256 chars.', true)
    .param('legalState', '', new Text(256), 'Project legal State. Max length: 256 chars.', true)
    .param('legalCity', '', new Text(256), 'Project legal City. Max length: 256 chars.', true)
    .param('legalAddress', '', new Text(256), 'Project legal Address. Max length: 256 chars.', true)
    .param('legalTaxId', '', new Text(256), 'Project legal Tax ID. Max length: 256 chars.', true)
    .inject('request')
    .inject('response')
    .inject('dbForConsole')
    .inject('cache')
    .inject('pools')
    .inject('hooks')
    .action(async (
        projectId: string,
        name: string,
        teamId: string,
        region: string,
        description: string,
        logo: string,
        url: string,
        legalName: string,
        legalCountry: string,
        legalState: string,
        legalCity: string,
        legalAddress: string,
        legalTaxId: string,
        request: Request,
        response: Response,
        dbForConsole: Database,
        cache: Cache,
        pools: Group,
        hooks: Hooks
    ) => {

        const team = await dbForConsole.getDocument('teams', teamId);

        if (team.isEmpty()) {
            throw new Exception(Exception.TEAM_NOT_FOUND);
        }

        const allowList = process.env._APP_PROJECT_REGIONS ? process.env._APP_PROJECT_REGIONS.split(',').filter(Boolean) : [];

        if (allowList.length > 0 && !allowList.includes(region)) {
            throw new Exception(Exception.PROJECT_REGION_UNSUPPORTED, `Region "${region}" is not supported`);
        }

        const auth = Config.getParam('auth', []);
        const auths: Record<string, any> = {
            limit: 0,
            maxSessions: APP_LIMIT_USER_SESSIONS_DEFAULT,
            passwordHistory: 0,
            passwordDictionary: false,
            duration: Auth.TOKEN_EXPIRATION_LOGIN_LONG,
            personalDataCheck: false
        };
        for (const method of auth) {
            auths[method.key ?? ''] = true;
        }

        projectId = (projectId === 'unique()') ? ID.unique() : projectId;

        const databases = Config.getParam('pools-database', []);

        const databaseOverride = process.env._APP_DATABASE_OVERRIDE;
        const index = databases.indexOf(databaseOverride);
        let dsn = index !== -1 ? databases[index] : databases[Math.floor(Math.random() * databases.length)];

        if (projectId === 'console') {
            throw new Exception(Exception.PROJECT_RESERVED_PROJECT, "'console' is a reserved project.");
        }

        if (dsn === process.env._APP_DATABASE_SHARED_TABLES) {
            const schema = 'appconda';
            const database = 'appconda';
            const namespace = process.env._APP_DATABASE_SHARED_NAMESPACE || '';
            dsn = `${schema}://${process.env._APP_DATABASE_SHARED_TABLES}?database=${database}`;

            if (namespace) {
                dsn += `&namespace=${namespace}`;
            }
        }

        let project;
        try {
            project = await dbForConsole.createDocument('projects', new Document({
                $id: projectId,
                $permissions: [
                    Permission.read(Role.team(ID.custom(teamId))),
                    Permission.update(Role.team(ID.custom(teamId), 'owner')),
                    Permission.update(Role.team(ID.custom(teamId), 'developer')),
                    Permission.delete(Role.team(ID.custom(teamId), 'owner')),
                    Permission.delete(Role.team(ID.custom(teamId), 'developer')),
                ],
                name: name,
                teamInternalId: team.getInternalId(),
                teamId: team.getId(),
                region: region,
                description: description,
                logo: logo,
                url: url,
                version: APP_VERSION_STABLE,
                legalName: legalName,
                legalCountry: legalCountry,
                legalState: legalState,
                legalCity: legalCity,
                legalAddress: legalAddress,
                legalTaxId: ID.custom(legalTaxId),
                services: {},
                platforms: null,
                oAuthProviders: [],
                webhooks: null,
                keys: null,
                auths: auths,
                search: [projectId, name].join(' '),
                database: dsn,
            }));
        } catch (e) {
            if (e instanceof Duplicate) {
                throw new Exception(Exception.PROJECT_ALREADY_EXISTS);
            }
            throw e;
        }

        try {
            dsn = new DSN(dsn);
        } catch (e) {
            if (e instanceof InvalidArgumentException) {
                dsn = new DSN(`mysql://${dsn}`);
            } else {
                throw e;
            }
        }

        const connection: Connection = await pools.get(dsn.getHost()).pop();
        const adapter = connection.getResource();
        const dbForProject = new Database(adapter, cache);

        if (dsn.getHost() === process.env._APP_DATABASE_SHARED_TABLES) {
            dbForProject
                .setSharedTables(true)
                .setTenant(project.getInternalId())
                .setNamespace(dsn.getParam('namespace'));
        } else {
            dbForProject
                .setSharedTables(false)
                .setTenant(null)
                .setNamespace(`_${project.getInternalId()}`);
        }

        await dbForProject.create();

        const audit = new Audit(dbForProject);
        await audit.setup();

        const abuse = new TimeLimit('', 0, 1, dbForProject);
        await abuse.setup();

        const collections = Config.getParam('collections', {})['projects'] ?? [];

        for (const [key, collection] of Object.entries(collections)) {
            if ((collection['$collection'] ?? '') !== Database.METADATA) {
                continue;
            }

            const attributes = collection['attributes'].map((attribute: any) => new Document(attribute));
            const indexes = collection['indexes'].map((index: any) => new Document(index));

            try {
                await dbForProject.createCollection(key, attributes, indexes);
            } catch (e) {
                if (!(e instanceof Duplicate)) {
                    throw e;
                }
            }
        }

        hooks.trigger('afterProjectCreation', [project, pools, cache]);

        response
            .setStatusCode(Response.STATUS_CODE_CREATED)
            .dynamic(project, Response.MODEL_PROJECT);
    });