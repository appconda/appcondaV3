import { AppcondaException as Exception } from "../../../Appconda/Extend/Exception";
import { Authorization, Boolean, Document, ID, Permission, Range, Text } from "../../../Tuval/Core";
import { Database, Duplicate, Limit, LimitException, Offset, Queries, Query, QueryException, Structure, UID } from "../../../Tuval/Database";

import { Database as EventDatabase, } from "../../../Appconda/Event/Database";
import { Event } from "../../../Appconda/Event/Event";
import { Response } from "../../../Appconda/Tuval/Response";
import { Request } from "../../../Appconda/Tuval/Request";
import { App } from "../../../Tuval/Http";
import { APP_AUTH_TYPE_ADMIN, APP_AUTH_TYPE_KEY, APP_LIMIT_ARRAY_ELEMENT_SIZE, APP_LIMIT_ARRAY_PARAMS_SIZE, APP_LIMIT_COUNT, DATABASE_TYPE_DELETE_COLLECTION, DATABASE_TYPE_DELETE_DATABASE } from "../../init";
import { CustomId } from "../../../Appconda/Tuval/Database/Validators/CustomId";
import { Config } from "../../../Tuval/Config";
import { Databases } from "../../../Appconda/Database/Validators/Queries/Databases";
import { Locale } from "../../../Tuval/Locale";
import { Audit } from "../../../Tuval/Audit";
import { Detector } from "../../../Appconda/Detector/Detector";
import { Permissions } from "../../../Tuval/Database/Validators/Permissions";
import { Collections } from "../../../Appconda/Database/Validators/Queries/Collections";

/**
 * Create attribute of varying type
 *
 * @param databaseId - The ID of the database
 * @param collectionId - The ID of the collection
 * @param attribute - The attribute document
 * @param response - The response object
 * @param dbForProject - The database instance for the project
 * @param queueForDatabase - The event queue for database operations
 * @param queueForEvents - The event queue for event operations
 * @returns Newly created attribute document
 * @throws AuthorizationException
 * @throws Exception
 * @throws LimitException
 * @throws RestrictedException
 * @throws StructureException
 * @throws ConflictException
 */
async function createAttribute(
    databaseId: string,
    collectionId: string,
    attribute: Document,
    response: Response,
    dbForProject: Database,
    queueForDatabase: EventDatabase,
    queueForEvents: Event
): Promise<Document> {
    const key = attribute.getAttribute('key');
    const type = attribute.getAttribute('type', '');
    const size = attribute.getAttribute('size', 0);
    const required = attribute.getAttribute('required', true);
    const signed = attribute.getAttribute('signed', true);
    const array = attribute.getAttribute('array', false);
    const format = attribute.getAttribute('format', '');
    const formatOptions = attribute.getAttribute('formatOptions', []);
    const filters = attribute.getAttribute('filters', []);
    const defaultValue = attribute.getAttribute('default');
    const options = attribute.getAttribute('options', []);

    const db = await Authorization.skip(() => dbForProject.getDocument('databases', databaseId));

    if (db.isEmpty()) {
        throw new Exception(Exception.DATABASE_NOT_FOUND);
    }

    const collection = await dbForProject.getDocument('database_' + db.getInternalId(), collectionId);

    if (collection.isEmpty()) {
        throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }

    if (format && !Structure.hasFormat(format, type)) {
        throw new Exception(Exception.ATTRIBUTE_FORMAT_UNSUPPORTED, `Format ${format} not available for ${type} attributes.`);
    }

    if (required && defaultValue !== undefined) {
        throw new Exception(Exception.ATTRIBUTE_DEFAULT_UNSUPPORTED, 'Cannot set default value for required attribute');
    }

    if (array && defaultValue !== undefined) {
        throw new Exception(Exception.ATTRIBUTE_DEFAULT_UNSUPPORTED, 'Cannot set default value for array attributes');
    }

    let relatedCollection: Document;
    if (type === Database.VAR_RELATIONSHIP) {
        options['side'] = Database.RELATION_SIDE_PARENT;
        relatedCollection = await dbForProject.getDocument('database_' + db.getInternalId(), options['relatedCollection'] || '');
        if (relatedCollection.isEmpty()) {
            throw new Exception(Exception.COLLECTION_NOT_FOUND, 'The related collection was not found.');
        }
    }

    let newAttribute: Document;
    try {
        newAttribute = new Document({
            '$id': ID.custom(`${db.getInternalId()}_${collection.getInternalId()}_${key}`),
            key,
            databaseInternalId: db.getInternalId(),
            databaseId: db.getId(),
            collectionInternalId: collection.getInternalId(),
            collectionId,
            type,
            status: 'processing',
            size,
            required,
            signed,
            default: defaultValue,
            array,
            format,
            formatOptions,
            filters,
            options,
        });

        await dbForProject.checkAttribute(collection, newAttribute);
        const createdAttribute = await dbForProject.createDocument('attributes', newAttribute);
    } catch (error) {
        dbForProject.purgeCachedDocument('database_' + db.getInternalId(), collectionId);
        dbForProject.purgeCachedCollection('database_' + db.getInternalId() + '_collection_' + collection.getInternalId());
        throw error;
    }

    dbForProject.purgeCachedDocument('database_' + db.getInternalId(), collectionId);
    dbForProject.purgeCachedCollection('database_' + db.getInternalId() + '_collection_' + collection.getInternalId());

    if (type === Database.VAR_RELATIONSHIP && options['twoWay']) {
        const twoWayKey = options['twoWayKey'];
        options['relatedCollection'] = collection.getId();
        options['twoWayKey'] = key;
        options['side'] = Database.RELATION_SIDE_CHILD;

        try {
            const twoWayAttribute = new Document({
                '$id': ID.custom(`${db.getInternalId()}_${relatedCollection.getInternalId()}_${twoWayKey}`),
                key: twoWayKey,
                databaseInternalId: db.getInternalId(),
                databaseId: db.getId(),
                collectionInternalId: relatedCollection.getInternalId(),
                collectionId: relatedCollection.getId(),
                type,
                status: 'processing',
                size,
                required,
                signed,
                default: defaultValue,
                array,
                format,
                formatOptions,
                filters,
                options,
            });

            await dbForProject.checkAttribute(relatedCollection, twoWayAttribute);
            await dbForProject.createDocument('attributes', twoWayAttribute);
        } catch (error) {
            await dbForProject.deleteDocument('attributes', newAttribute.getId());
            throw error;
        }

        dbForProject.purgeCachedDocument('database_' + db.getInternalId(), relatedCollection.getId());
        dbForProject.purgeCachedCollection('database_' + db.getInternalId() + '_collection_' + relatedCollection.getInternalId());
    }

    queueForDatabase
        .setType('DATABASE_TYPE_CREATE_ATTRIBUTE')
        .setDatabase(db)
        .setCollection(collection)
        .setDocument(newAttribute);

    queueForEvents
        .setContext('collection', collection)
        .setContext('database', db)
        .setParam('databaseId', databaseId)
        .setParam('collectionId', collection.getId())
        .setParam('attributeId', newAttribute.getId());

    response.setStatusCode(Response.STATUS_CODE_CREATED);

    return newAttribute;
}



/**
 * Update attribute of varying type
 *
 * @param databaseId - The ID of the database
 * @param collectionId - The ID of the collection
 * @param key - The key of the attribute
 * @param dbForProject - The database instance for the project
 * @param queueForEvents - The event queue for event operations
 * @param type - The type of the attribute
 * @param filter - The filter for the attribute
 * @param defaultValue - The default value for the attribute
 * @param required - Whether the attribute is required
 * @param min - The minimum value for the attribute
 * @param max - The maximum value for the attribute
 * @param elements - The elements for enum type attributes
 * @param options - Additional options for the attribute
 * @returns Updated attribute document
 * @throws AuthorizationException
 * @throws Exception
 * @throws LimitException
 * @throws RestrictedException
 * @throws StructureException
 * @throws ConflictException
 */
async function updateAttribute(
    databaseId: string,
    collectionId: string,
    key: string,
    dbForProject: Database,
    queueForEvents: Event,
    type: string,
    filter: string | null = null,
    defaultValue: string | boolean | number | null = null,
    required: boolean | null = null,
    min: number | null = null,
    max: number | null = null,
    elements: string[] | null = null,
    options: Record<string, any> = {}
): Promise<Document> {
    const db = await Authorization.skip(() => dbForProject.getDocument('databases', databaseId));

    if (db.isEmpty()) {
        throw new Exception(Exception.DATABASE_NOT_FOUND);
    }

    const collection = await dbForProject.getDocument('database_' + db.getInternalId(), collectionId);

    if (collection.isEmpty()) {
        throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }

    const attribute = await dbForProject.getDocument('attributes', `${db.getInternalId()}_${collection.getInternalId()}_${key}`);

    if (attribute.isEmpty()) {
        throw new Exception(Exception.ATTRIBUTE_NOT_FOUND);
    }

    if (attribute.getAttribute('status') !== 'available') {
        throw new Exception(Exception.ATTRIBUTE_NOT_AVAILABLE);
    }

    if (attribute.getAttribute('type') !== type) {
        throw new Exception(Exception.ATTRIBUTE_TYPE_INVALID);
    }

    if (attribute.getAttribute('type') === Database.VAR_STRING && attribute.getAttribute('filter') !== filter) {
        throw new Exception(Exception.ATTRIBUTE_TYPE_INVALID);
    }

    if (required && defaultValue !== undefined) {
        throw new Exception(Exception.ATTRIBUTE_DEFAULT_UNSUPPORTED, 'Cannot set default value for required attribute');
    }

    if (attribute.getAttribute('array', false) && defaultValue !== undefined) {
        throw new Exception(Exception.ATTRIBUTE_DEFAULT_UNSUPPORTED, 'Cannot set default value for array attributes');
    }

    const collectionIdFull = `database_${db.getInternalId()}_collection_${collection.getInternalId()}`;

    attribute
        .setAttribute('default', defaultValue)
        .setAttribute('required', required);

    const formatOptions = attribute.getAttribute('formatOptions');

    switch (attribute.getAttribute('format')) {
        case 'APP_DATABASE_ATTRIBUTE_INT_RANGE':
        case 'APP_DATABASE_ATTRIBUTE_FLOAT_RANGE':
            if (min === formatOptions['min'] && max === formatOptions['max']) {
                break;
            }

            if (min > max) {
                throw new Exception(Exception.ATTRIBUTE_VALUE_INVALID, 'Minimum value must be lesser than maximum value');
            }

            const validator = attribute.getAttribute('format') === 'APP_DATABASE_ATTRIBUTE_INT_RANGE'
                ? new Range(min, max, Database.VAR_INTEGER)
                : new Range(min, max, Database.VAR_FLOAT);

            if (defaultValue !== null && !validator.isValid(defaultValue)) {
                throw new Exception(Exception.ATTRIBUTE_VALUE_INVALID, validator.getDescription());
            }

            options = { min, max };
            attribute.setAttribute('formatOptions', options);

            break;
        case 'APP_DATABASE_ATTRIBUTE_ENUM':
            if (!elements || elements.length === 0) {
                throw new Exception(Exception.ATTRIBUTE_VALUE_INVALID, 'Enum elements must not be empty');
            }

            for (const element of elements) {
                if (element.length === 0) {
                    throw new Exception(Exception.ATTRIBUTE_VALUE_INVALID, 'Each enum element must not be empty');
                }
            }

            if (defaultValue !== null && !elements.includes(defaultValue as string)) {
                throw new Exception(Exception.ATTRIBUTE_VALUE_INVALID, 'Default value not found in elements');
            }

            options = { elements };
            attribute.setAttribute('formatOptions', options);

            break;
    }

    if (type === Database.VAR_RELATIONSHIP) {
        const primaryDocumentOptions = { ...attribute.getAttribute('options', {}), ...options };
        attribute.setAttribute('options', primaryDocumentOptions);

        await dbForProject.updateRelationship(
            collectionIdFull,
            key,
            primaryDocumentOptions['onDelete']
        );

        if (primaryDocumentOptions['twoWay']) {
            const relatedCollection = await dbForProject.getDocument('database_' + db.getInternalId(), primaryDocumentOptions['relatedCollection']);

            const relatedAttribute = await dbForProject.getDocument('attributes', `${db.getInternalId()}_${relatedCollection.getInternalId()}_${primaryDocumentOptions['twoWayKey']}`);
            const relatedOptions = { ...relatedAttribute.getAttribute('options'), ...options };
            relatedAttribute.setAttribute('options', relatedOptions);
            await dbForProject.updateDocument('attributes', `${db.getInternalId()}_${relatedCollection.getInternalId()}_${primaryDocumentOptions['twoWayKey']}`, relatedAttribute);
            dbForProject.purgeCachedDocument('database_' + db.getInternalId(), relatedCollection.getId());
        }
    } else {
        await dbForProject.updateAttribute({
            collection: collectionIdFull,
            id: key,
            required,
            defaultValue: defaultValue,
            formatOptions: options ?? null
        });
    }

    const updatedAttribute = await dbForProject.updateDocument('attributes', `${db.getInternalId()}_${collection.getInternalId()}_${key}`, attribute);
    dbForProject.purgeCachedDocument('database_' + db.getInternalId(), collection.getId());

    queueForEvents
        .setContext('collection', collection)
        .setContext('database', db)
        .setParam('databaseId', databaseId)
        .setParam('collectionId', collection.getId())
        .setParam('attributeId', updatedAttribute.getId());

    return updatedAttribute;
}

App.init()
    .groups(['api', 'database'])
    .inject('request')
    .inject('dbForProject')
    .action(async ({ request, dbForProject }: { request: Request, dbForProject: Database }) => {
        const timeout = parseInt(request.getHeader('x-appconda-timeout'), 10);

        if (!isNaN(timeout) && App.isDevelopment()) {
            dbForProject.setTimeout(timeout);
        }
    });


App.post('/v1/databases')
    .desc('Create database')
    .groups(['api', 'database'])
    .label('event', 'databases.[databaseId].create')
    .label('scope', 'databases.write')
    .label('audits.event', 'database.create')
    .label('audits.resource', 'database/{response.$id}')
    .label('sdk.auth', [APP_AUTH_TYPE_KEY])
    .label('sdk.namespace', 'databases')
    .label('sdk.method', 'create')
    .label('sdk.description', '/docs/references/databases/create.md')
    .label('sdk.response.code', Response.STATUS_CODE_CREATED)
    .label('sdk.response.type', Response.CONTENT_TYPE_JSON)
    .label('sdk.response.model', Response.MODEL_DATABASE)
    .param('databaseId', '', new CustomId(), 'Unique Id. Choose a custom ID or generate a random ID with `ID.unique()`. Valid chars are a-z, A-Z, 0-9, period, hyphen, and underscore. Can\'t start with a special char. Max length is 36 chars.')
    .param('name', '', new Text(128), 'Database name. Max length: 128 chars.')
    .param('enabled', true, new Boolean(), 'Is the database enabled? When set to \'disabled\', users cannot access the database but Server SDKs with an API key can still read and write to the database. No data is lost when this is toggled.', true)
    .inject('response')
    .inject('dbForProject')
    .inject('queueForEvents')
    .action(async ({ databaseId, name, enabled, response, dbForProject, queueForEvents }: { databaseId: string, name: string, enabled: boolean, response: Response, dbForProject: Database, queueForEvents: Event }) => {

        databaseId = databaseId === 'unique()' ? ID.unique() : databaseId;

        let database: Document;
        try {
            await dbForProject.createDocument('databases', new Document({
                '$id': databaseId,
                'name': name,
                'enabled': enabled,
                'search': [databaseId, name].join(' '),
            }));
            database = await dbForProject.getDocument('databases', databaseId);

            const collections = (Config.getParam('collections', [])['databases'] ?? {})['collections'] ?? [];
            if (!collections) {
                throw new Exception(Exception.GENERAL_SERVER_ERROR, 'The "collections" collection is not configured.');
            }

            const attributes = collections['attributes'].map((attribute: any) => new Document({
                '$id': attribute['$id'],
                'type': attribute['type'],
                'size': attribute['size'],
                'required': attribute['required'],
                'signed': attribute['signed'],
                'array': attribute['array'],
                'filters': attribute['filters'],
                'default': attribute['default'] ?? null,
                'format': attribute['format'] ?? ''
            }));

            const indexes = collections['indexes'].map((index: any) => new Document({
                '$id': index['$id'],
                'type': index['type'],
                'attributes': index['attributes'],
                'lengths': index['lengths'],
                'orders': index['orders'],
            }));

            await dbForProject.createCollection('database_' + database.getInternalId(), attributes, indexes);
        } catch (error) {
            if (error instanceof Duplicate) {
                throw new Exception(Exception.DATABASE_ALREADY_EXISTS);
            }
            throw error;
        }

        queueForEvents.setParam('databaseId', database.getId());

        response
            .setStatusCode(Response.STATUS_CODE_CREATED)
            .dynamic(database, Response.MODEL_DATABASE);
    });


App.get('/v1/databases')
    .desc('List databases')
    .groups(['api', 'database'])
    .label('scope', 'databases.read')
    .label('sdk.auth', [APP_AUTH_TYPE_KEY])
    .label('sdk.namespace', 'databases')
    .label('sdk.method', 'list')
    .label('sdk.description', '/docs/references/databases/list.md')
    .label('sdk.response.code', Response.STATUS_CODE_OK)
    .label('sdk.response.type', Response.CONTENT_TYPE_JSON)
    .label('sdk.response.model', Response.MODEL_DATABASE_LIST)
    .param('queries', [], new Databases(), `Array of query strings generated using the Query class provided by the SDK. [Learn more about queries](https://appwrite.io/docs/queries). Maximum of ${APP_LIMIT_ARRAY_PARAMS_SIZE} queries are allowed, each ${APP_LIMIT_ARRAY_ELEMENT_SIZE} characters long. You may filter on the following attributes: ${Databases.ALLOWED_ATTRIBUTES.join(', ')}`, true)
    .param('search', '', new Text(256), 'Search term to filter your list results. Max length: 256 chars.', true)
    .inject('response')
    .inject('dbForProject')
    .action(async ({ queries, search, response, dbForProject }: { queries: any[], search: string, response: Response, dbForProject: Database }) => {

        try {
            queries = Query.parseQueries(queries);
        } catch (e) {
            if (e instanceof QueryException) {
                throw new Exception(Exception.GENERAL_QUERY_INVALID, e.message);
            }
            throw e;
        }

        if (search) {
            queries.push(Query.search('search', search));
        }

        const cursor = queries.filter(query => [Query.TYPE_CURSOR_AFTER, Query.TYPE_CURSOR_BEFORE].includes(query.getMethod()));
        const cursorQuery = cursor[0];
        if (cursorQuery) {
            const databaseId = cursorQuery.getValue();
            const cursorDocument = await dbForProject.getDocument('databases', databaseId);

            if (cursorDocument.isEmpty()) {
                throw new Exception(Exception.GENERAL_CURSOR_NOT_FOUND, `Database '${databaseId}' for the 'cursor' value not found.`);
            }

            cursorQuery.setValue(cursorDocument);
        }

        const filterQueries = Query.groupByType(queries)['filters'];

        response.dynamic(new Document({
            'databases': await dbForProject.find('databases', queries),
            'total': await dbForProject.count('databases', filterQueries, APP_LIMIT_COUNT),
        }), Response.MODEL_DATABASE_LIST);
    });



App.get('/v1/databases/:databaseId')
    .desc('Get database')
    .groups(['api', 'database'])
    .label('scope', 'databases.read')
    .label('sdk.auth', [APP_AUTH_TYPE_KEY])
    .label('sdk.namespace', 'databases')
    .label('sdk.method', 'get')
    .label('sdk.description', '/docs/references/databases/get.md')
    .label('sdk.response.code', Response.STATUS_CODE_OK)
    .label('sdk.response.type', Response.CONTENT_TYPE_JSON)
    .label('sdk.response.model', Response.MODEL_DATABASE)
    .param('databaseId', '', new UID(), 'Database ID.')
    .inject('response')
    .inject('dbForProject')
    .action(async ({ databaseId, response, dbForProject }: { databaseId: string, response: Response, dbForProject: Database }) => {

        const database = await dbForProject.getDocument('databases', databaseId);

        if (database.isEmpty()) {
            throw new Exception(Exception.DATABASE_NOT_FOUND);
        }

        response.dynamic(database, Response.MODEL_DATABASE);
    });


App.get('/v1/databases/:databaseId/logs')
    .desc('List database logs')
    .groups(['api', 'database'])
    .label('scope', 'databases.read')
    .label('sdk.auth', [APP_AUTH_TYPE_ADMIN])
    .label('sdk.namespace', 'databases')
    .label('sdk.method', 'listLogs')
    .label('sdk.description', '/docs/references/databases/get-logs.md')
    .label('sdk.response.code', Response.STATUS_CODE_OK)
    .label('sdk.response.type', Response.CONTENT_TYPE_JSON)
    .label('sdk.response.model', Response.MODEL_LOG_LIST)
    .param('databaseId', '', new UID(), 'Database ID.')
    .param('queries', [], new Queries([new Limit(), new Offset()]), 'Array of query strings generated using the Query class provided by the SDK. [Learn more about queries](https://appwrite.io/docs/queries). Only supported methods are limit and offset', true)
    .inject('response')
    .inject('dbForProject')
    .inject('locale')
    .inject('geodb')
    .action(async ({ databaseId, queries, response, dbForProject, locale, geodb }: { databaseId: string, queries: any[], response: Response, dbForProject: Database, locale: Locale, geodb: any }) => {

        const database = await dbForProject.getDocument('databases', databaseId);

        if (database.isEmpty()) {
            throw new Exception(Exception.DATABASE_NOT_FOUND);
        }

        try {
            queries = Query.parseQueries(queries);
        } catch (e) {
            if (e instanceof QueryException) {
                throw new Exception(Exception.GENERAL_QUERY_INVALID, e.message);
            }
            throw e;
        }

        const grouped = Query.groupByType(queries);
        const limit = grouped['limit'] ?? APP_LIMIT_COUNT;
        const offset = grouped['offset'] ?? 0;

        const audit = new Audit(dbForProject);
        const resource = 'database/' + databaseId;
        const logs = await audit.getLogsByResource(resource, limit, offset);

        const output = [];

        for (const log of logs) {
            const userAgent = log['userAgent'] || 'UNKNOWN';

            const detector = new Detector(userAgent);
            detector.skipBotDetection();

            const os = detector.getOS();
            const client = detector.getClient();
            const device = detector.getDevice();

            const logDocument = new Document({
                event: log['event'],
                userId: ID.custom(log['data']['userId']),
                userEmail: log['data']['userEmail'] || null,
                userName: log['data']['userName'] || null,
                mode: log['data']['mode'] || null,
                ip: log['ip'],
                time: log['time'],
                osCode: os['osCode'],
                osName: os['osName'],
                osVersion: os['osVersion'],
                clientType: client['clientType'],
                clientCode: client['clientCode'],
                clientName: client['clientName'],
                clientVersion: client['clientVersion'],
                clientEngine: client['clientEngine'],
                clientEngineVersion: client['clientEngineVersion'],
                deviceName: device['deviceName'],
                deviceBrand: device['deviceBrand'],
                deviceModel: device['deviceModel']
            });

            const record = geodb.get(log['ip']);

            if (record) {
                logDocument['countryCode'] = locale.getText('countries.' + record['country']['iso_code'].toLowerCase(), false) ? record['country']['iso_code'].toLowerCase() : '--';
                logDocument['countryName'] = locale.getText('countries.' + record['country']['iso_code'].toLowerCase(), locale.getText('locale.country.unknown'));
            } else {
                logDocument['countryCode'] = '--';
                logDocument['countryName'] = locale.getText('locale.country.unknown');
            }

            output.push(logDocument);
        }

        response.dynamic(new Document({
            total: await audit.countLogsByResource(resource),
            logs: output,
        }), Response.MODEL_LOG_LIST);
    });


App.put('/v1/databases/:databaseId')
    .desc('Update database')
    .groups(['api', 'database', 'schema'])
    .label('scope', 'databases.write')
    .label('event', 'databases.[databaseId].update')
    .label('audits.event', 'database.update')
    .label('audits.resource', 'database/{response.$id}')
    .label('sdk.auth', [APP_AUTH_TYPE_KEY])
    .label('sdk.namespace', 'databases')
    .label('sdk.method', 'update')
    .label('sdk.description', '/docs/references/databases/update.md')
    .label('sdk.response.code', Response.STATUS_CODE_OK)
    .label('sdk.response.type', Response.CONTENT_TYPE_JSON)
    .label('sdk.response.model', Response.MODEL_DATABASE)
    .param('databaseId', '', new UID(), 'Database ID.')
    .param('name', null, new Text(128), 'Database name. Max length: 128 chars.')
    .param('enabled', true, new Boolean(), 'Is database enabled? When set to \'disabled\', users cannot access the database but Server SDKs with an API key can still read and write to the database. No data is lost when this is toggled.', true)
    .inject('response')
    .inject('dbForProject')
    .inject('queueForEvents')
    .action(async ({ databaseId, name, enabled, response, dbForProject, queueForEvents }: { databaseId: string, name: string, enabled: boolean, response: Response, dbForProject: Database, queueForEvents: Event }) => {

        const database = await dbForProject.getDocument('databases', databaseId);

        if (database.isEmpty()) {
            throw new Exception(Exception.DATABASE_NOT_FOUND);
        }

        const updatedDatabase = await dbForProject.updateDocument('databases', databaseId, database
            .setAttribute('name', name)
            .setAttribute('enabled', enabled)
            .setAttribute('search', [databaseId, name].join(' ')));

        queueForEvents.setParam('databaseId', updatedDatabase.getId());

        response.dynamic(updatedDatabase, Response.MODEL_DATABASE);
    });


App.delete('/v1/databases/:databaseId')
    .desc('Delete database')
    .groups(['api', 'database', 'schema'])
    .label('scope', 'databases.write')
    .label('event', 'databases.[databaseId].delete')
    .label('audits.event', 'database.delete')
    .label('audits.resource', 'database/{request.databaseId}')
    .label('sdk.auth', [APP_AUTH_TYPE_KEY])
    .label('sdk.namespace', 'databases')
    .label('sdk.method', 'delete')
    .label('sdk.description', '/docs/references/databases/delete.md')
    .label('sdk.response.code', Response.STATUS_CODE_NOCONTENT)
    .label('sdk.response.model', Response.MODEL_NONE)
    .param('databaseId', '', new UID(), 'Database ID.')
    .inject('response')
    .inject('dbForProject')
    .inject('queueForDatabase')
    .inject('queueForEvents')
    .action(async ({ databaseId, response, dbForProject, queueForDatabase, queueForEvents }: { databaseId: string, response: Response, dbForProject: Database, queueForDatabase: EventDatabase, queueForEvents: Event }) => {

        const database = await dbForProject.getDocument('databases', databaseId);

        if (database.isEmpty()) {
            throw new Exception(Exception.DATABASE_NOT_FOUND);
        }

        if (!await dbForProject.deleteDocument('databases', databaseId)) {
            throw new Exception(Exception.GENERAL_SERVER_ERROR, 'Failed to remove collection from DB');
        }

        await dbForProject.purgeCachedDocument('databases', database.getId());
        await dbForProject.purgeCachedCollection('databases_' + database.getInternalId());

        queueForDatabase
            .setType(DATABASE_TYPE_DELETE_DATABASE)
            .setDatabase(database);

        queueForEvents
            .setParam('databaseId', database.getId())
            .setPayload(response.output(database, Response.MODEL_DATABASE));

        response.noContent();
    });


App.post('/v1/databases/:databaseId/collections')
    .desc('Create collection')
    .groups(['api', 'database'])
    .label('event', 'databases.[databaseId].collections.[collectionId].create')
    .label('scope', 'collections.write')
    .label('audits.event', 'collection.create')
    .label('audits.resource', 'database/{request.databaseId}/collection/{response.$id}')
    .label('sdk.auth', [APP_AUTH_TYPE_KEY])
    .label('sdk.namespace', 'databases')
    .label('sdk.method', 'createCollection')
    .label('sdk.description', '/docs/references/databases/create-collection.md')
    .label('sdk.response.code', Response.STATUS_CODE_CREATED)
    .label('sdk.response.type', Response.CONTENT_TYPE_JSON)
    .label('sdk.response.model', Response.MODEL_COLLECTION)
    .param('databaseId', '', new UID(), 'Database ID.')
    .param('collectionId', '', new CustomId(), 'Unique Id. Choose a custom ID or generate a random ID with `ID.unique()`. Valid chars are a-z, A-Z, 0-9, period, hyphen, and underscore. Can\'t start with a special char. Max length is 36 chars.')
    .param('name', '', new Text(128), 'Collection name. Max length: 128 chars.')
    .param('permissions', null, new Permissions(APP_LIMIT_ARRAY_PARAMS_SIZE), 'An array of permissions strings. By default, no user is granted with any permissions. [Learn more about permissions](https://appwrite.io/docs/permissions).', true)
    .param('documentSecurity', false, new Boolean(true), 'Enables configuring permissions for individual documents. A user needs one of document or collection level permissions to access a document. [Learn more about permissions](https://appwrite.io/docs/permissions).', true)
    .param('enabled', true, new Boolean(), 'Is collection enabled? When set to \'disabled\', users cannot access the collection but Server SDKs with and API key can still read and write to the collection. No data is lost when this is toggled.', true)
    .inject('response')
    .inject('dbForProject')
    .inject('mode')
    .inject('queueForEvents')
    .action(async ({ databaseId, collectionId, name, permissions, documentSecurity, enabled, response, dbForProject, mode, queueForEvents }: { databaseId: string, collectionId: string, name: string, permissions: string[] | null, documentSecurity: boolean, enabled: boolean, response: Response, dbForProject: Database, mode: string, queueForEvents: Event }) => {

        const database = await Authorization.skip(() => dbForProject.getDocument('databases', databaseId));

        if (database.isEmpty()) {
            throw new Exception(Exception.DATABASE_NOT_FOUND);
        }

        collectionId = collectionId === 'unique()' ? ID.unique() : collectionId;

        // Map aggregate permissions into the multiple permissions they represent.
        permissions = Permission.aggregate(permissions);

        let collection: Document;
        try {
            await dbForProject.createDocument('database_' + database.getInternalId(), new Document({
                '$id': collectionId,
                'databaseInternalId': database.getInternalId(),
                'databaseId': databaseId,
                '$permissions': permissions ?? [],
                'documentSecurity': documentSecurity,
                'enabled': enabled,
                'name': name,
                'search': [collectionId, name].join(' '),
            }));
            const collection = await dbForProject.getDocument('database_' + database.getInternalId(), collectionId);

            await dbForProject.createCollection('database_' + database.getInternalId() + '_collection_' + collection.getInternalId(),
                [], [], permissions ?? [], documentSecurity);
        } catch (error) {
            if (error instanceof Duplicate) {
                throw new Exception(Exception.COLLECTION_ALREADY_EXISTS);
            }
            if (error instanceof LimitException) {
                throw new Exception(Exception.COLLECTION_LIMIT_EXCEEDED);
            }
            throw error;
        }

        queueForEvents
            .setContext('database', database)
            .setParam('databaseId', databaseId)
            .setParam('collectionId', collection.getId());

        response
            .setStatusCode(Response.STATUS_CODE_CREATED)
            .dynamic(collection, Response.MODEL_COLLECTION);
    });


App.get('/v1/databases/:databaseId/collections')
    .alias('/v1/database/collections')
    .desc('List collections')
    .groups(['api', 'database'])
    .label('scope', 'collections.read')
    .label('sdk.auth', [APP_AUTH_TYPE_KEY])
    .label('sdk.namespace', 'databases')
    .label('sdk.method', 'listCollections')
    .label('sdk.description', '/docs/references/databases/list-collections.md')
    .label('sdk.response.code', Response.STATUS_CODE_OK)
    .label('sdk.response.type', Response.CONTENT_TYPE_JSON)
    .label('sdk.response.model', Response.MODEL_COLLECTION_LIST)
    .param('databaseId', '', new UID(), 'Database ID.')
    .param('queries', [], new Collections(), `Array of query strings generated using the Query class provided by the SDK. [Learn more about queries](https://appwrite.io/docs/queries). Maximum of ${APP_LIMIT_ARRAY_PARAMS_SIZE} queries are allowed, each ${APP_LIMIT_ARRAY_ELEMENT_SIZE} characters long. You may filter on the following attributes: ${Collections.ALLOWED_ATTRIBUTES.join(', ')}`, true)
    .param('search', '', new Text(256), 'Search term to filter your list results. Max length: 256 chars.', true)
    .inject('response')
    .inject('dbForProject')
    .inject('mode')
    .action(async ({ databaseId, queries, search, response, dbForProject, mode }: { databaseId: string, queries: any[], search: string, response: Response, dbForProject: Database, mode: string }) => {

        const database = await Authorization.skip(() => dbForProject.getDocument('databases', databaseId));

        if (database.isEmpty()) {
            throw new Exception(Exception.DATABASE_NOT_FOUND);
        }

        try {
            queries = Query.parseQueries(queries);
        } catch (e) {
            if (e instanceof QueryException) {
                throw new Exception(Exception.GENERAL_QUERY_INVALID, e.message);
            }
            throw e;
        }

        if (search) {
            queries.push(Query.search('search', search));
        }

        // Get cursor document if there was a cursor query
        const cursor = queries.find(query => [Query.TYPE_CURSOR_AFTER, Query.TYPE_CURSOR_BEFORE].includes(query.getMethod()));
        if (cursor) {
            const collectionId = cursor.getValue();
            const cursorDocument = await dbForProject.getDocument('database_' + database.getInternalId(), collectionId);

            if (cursorDocument.isEmpty()) {
                throw new Exception(Exception.GENERAL_CURSOR_NOT_FOUND, `Collection '${collectionId}' for the 'cursor' value not found.`);
            }

            cursor.setValue(cursorDocument);
        }

        const filterQueries = Query.groupByType(queries)['filters'];

        response.dynamic(new Document({
            collections: await dbForProject.find('database_' + database.getInternalId(), queries),
            total: await dbForProject.count('database_' + database.getInternalId(), filterQueries, APP_LIMIT_COUNT),
        }), Response.MODEL_COLLECTION_LIST);
    });


App.get('/v1/databases/:databaseId/collections/:collectionId')
    //.alias('/v1/database/collections/:collectionId', { databaseId: 'default' })
    .desc('Get collection')
    .groups(['api', 'database'])
    .label('scope', 'collections.read')
    .label('sdk.auth', [APP_AUTH_TYPE_KEY])
    .label('sdk.namespace', 'databases')
    .label('sdk.method', 'getCollection')
    .label('sdk.description', '/docs/references/databases/get-collection.md')
    .label('sdk.response.code', Response.STATUS_CODE_OK)
    .label('sdk.response.type', Response.CONTENT_TYPE_JSON)
    .label('sdk.response.model', Response.MODEL_COLLECTION)
    .param('databaseId', '', new UID(), 'Database ID.')
    .param('collectionId', '', new UID(), 'Collection ID.')
    .inject('response')
    .inject('dbForProject')
    .inject('mode')
    .action(async ({ databaseId, collectionId, response, dbForProject, mode }: { databaseId: string, collectionId: string, response: Response, dbForProject: Database, mode: string }) => {

        const database = await Authorization.skip(async () => await dbForProject.getDocument('databases', databaseId));

        if (database.isEmpty()) {
            throw new Exception(Exception.DATABASE_NOT_FOUND);
        }

        const collection = await dbForProject.getDocument('database_' + database.getInternalId(), collectionId);

        if (collection.isEmpty()) {
            throw new Exception(Exception.COLLECTION_NOT_FOUND);
        }

        response.dynamic(collection, Response.MODEL_COLLECTION);
    });



App.get('/v1/databases/:databaseId/collections/:collectionId/logs')
    //.alias('/v1/database/collections/:collectionId/logs', { databaseId: 'default' })
    .desc('List collection logs')
    .groups(['api', 'database'])
    .label('scope', 'collections.read')
    .label('sdk.auth', [APP_AUTH_TYPE_ADMIN])
    .label('sdk.namespace', 'databases')
    .label('sdk.method', 'listCollectionLogs')
    .label('sdk.description', '/docs/references/databases/get-collection-logs.md')
    .label('sdk.response.code', Response.STATUS_CODE_OK)
    .label('sdk.response.type', Response.CONTENT_TYPE_JSON)
    .label('sdk.response.model', Response.MODEL_LOG_LIST)
    .param('databaseId', '', new UID(), 'Database ID.')
    .param('collectionId', '', new UID(), 'Collection ID.')
    .param('queries', [], new Queries([new Limit(), new Offset()]), 'Array of query strings generated using the Query class provided by the SDK. [Learn more about queries](https://appwrite.io/docs/queries). Only supported methods are limit and offset', true)
    .inject('response')
    .inject('dbForProject')
    .inject('locale')
    .inject('geodb')
    .action(async ({ databaseId, collectionId, queries, response, dbForProject, locale, geodb }: { databaseId: string, collectionId: string, queries: any[], response: Response, dbForProject: Database, locale: Locale, geodb: any }) => {

        const database = await Authorization.skip(async () => await dbForProject.getDocument('databases', databaseId));

        if (database.isEmpty()) {
            throw new Exception(Exception.DATABASE_NOT_FOUND);
        }

        const collectionDocument = await dbForProject.getDocument('database_' + database.getInternalId(), collectionId);
        const collection = await dbForProject.getCollection('database_' + database.getInternalId() + '_collection_' + collectionDocument.getInternalId());

        if (collection.isEmpty()) {
            throw new Exception(Exception.COLLECTION_NOT_FOUND);
        }

        try {
            queries = Query.parseQueries(queries);
        } catch (e) {
            if (e instanceof QueryException) {
                throw new Exception(Exception.GENERAL_QUERY_INVALID, e.message);
            }
            throw e;
        }

        const grouped = Query.groupByType(queries);
        const limit = grouped['limit'] ?? APP_LIMIT_COUNT;
        const offset = grouped['offset'] ?? 0;

        const audit = new Audit(dbForProject);
        const resource = 'database/' + databaseId + '/collection/' + collectionId;
        const logs = await audit.getLogsByResource(resource, limit, offset);

        const output = [];

        for (const log of logs) {
            const userAgent = log['userAgent'] || 'UNKNOWN';

            const detector = new Detector(userAgent);
            detector.skipBotDetection();

            const os = detector.getOS();
            const client = detector.getClient();
            const device = detector.getDevice();

            const logDocument = new Document({
                event: log['event'],
                userId: log['data']['userId'],
                userEmail: log['data']['userEmail'] || null,
                userName: log['data']['userName'] || null,
                mode: log['data']['mode'] || null,
                ip: log['ip'],
                time: log['time'],
                osCode: os['osCode'],
                osName: os['osName'],
                osVersion: os['osVersion'],
                clientType: client['clientType'],
                clientCode: client['clientCode'],
                clientName: client['clientName'],
                clientVersion: client['clientVersion'],
                clientEngine: client['clientEngine'],
                clientEngineVersion: client['clientEngineVersion'],
                deviceName: device['deviceName'],
                deviceBrand: device['deviceBrand'],
                deviceModel: device['deviceModel']
            });

            const record = geodb.get(log['ip']);

            if (record) {
                logDocument.setAttribute('countryCode', locale.getText('countries.' + record['country']['iso_code'].toLowerCase(), false) ? record['country']['iso_code'].toLowerCase() : '--');
                logDocument.setAttribute('countryName', locale.getText('countries.' + record['country']['iso_code'].toLowerCase(), locale.getText('locale.country.unknown')));
            } else {
                logDocument.setAttribute('countryCode', '--');
                logDocument.setAttribute('countryName', locale.getText('locale.country.unknown'));
            }

            output.push(logDocument);
        }

        response.dynamic(new Document({
            total: await audit.countLogsByResource(resource),
            logs: output,
        }), Response.MODEL_LOG_LIST);
    });

App.put('/v1/databases/:databaseId/collections/:collectionId')
    //.alias('/v1/database/collections/:collectionId', { databaseId: 'default' })
    .desc('Update collection')
    .groups(['api', 'database', 'schema'])
    .label('scope', 'collections.write')
    .label('event', 'databases.[databaseId].collections.[collectionId].update')
    .label('audits.event', 'collection.update')
    .label('audits.resource', 'database/{request.databaseId}/collection/{request.collectionId}')
    .label('sdk.auth', [APP_AUTH_TYPE_KEY])
    .label('sdk.namespace', 'databases')
    .label('sdk.method', 'updateCollection')
    .label('sdk.description', '/docs/references/databases/update-collection.md')
    .label('sdk.response.code', Response.STATUS_CODE_OK)
    .label('sdk.response.type', Response.CONTENT_TYPE_JSON)
    .label('sdk.response.model', Response.MODEL_COLLECTION)
    .param('databaseId', '', new UID(), 'Database ID.')
    .param('collectionId', '', new UID(), 'Collection ID.')
    .param('name', null, new Text(128), 'Collection name. Max length: 128 chars.')
    .param('permissions', null, new Permissions(APP_LIMIT_ARRAY_PARAMS_SIZE), 'An array of permission strings. By default, the current permissions are inherited. [Learn more about permissions](https://appwrite.io/docs/permissions).', true)
    .param('documentSecurity', false, new Boolean(true), 'Enables configuring permissions for individual documents. A user needs one of document or collection level permissions to access a document. [Learn more about permissions](https://appwrite.io/docs/permissions).', true)
    .param('enabled', true, new Boolean(), 'Is collection enabled? When set to \'disabled\', users cannot access the collection but Server SDKs with and API key can still read and write to the collection. No data is lost when this is toggled.', true)
    .inject('response')
    .inject('dbForProject')
    .inject('mode')
    .inject('queueForEvents')
    .action(async ({ databaseId, collectionId, name, permissions, documentSecurity, enabled, response, dbForProject, mode, queueForEvents }: { databaseId: string, collectionId: string, name: string, permissions: string[] | null, documentSecurity: boolean, enabled: boolean, response: Response, dbForProject: Database, mode: string, queueForEvents: Event }) => {

        const database = await Authorization.skip(() => dbForProject.getDocument('databases', databaseId));

        if (database.isEmpty()) {
            throw new Exception(Exception.DATABASE_NOT_FOUND);
        }

        let collection = await dbForProject.getDocument('database_' + database.getInternalId(), collectionId);

        if (collection.isEmpty()) {
            throw new Exception(Exception.COLLECTION_NOT_FOUND);
        }

        permissions = permissions ?? collection.getPermissions() ?? [];

        // Map aggregate permissions into the multiple permissions they represent.
        permissions = Permission.aggregate(permissions);

        enabled = enabled ?? collection.getAttribute('enabled', true);

        collection = await dbForProject.updateDocument('database_' + database.getInternalId(), collectionId, collection
            .setAttribute('name', name)
            .setAttribute('$permissions', permissions)
            .setAttribute('documentSecurity', documentSecurity)
            .setAttribute('enabled', enabled)
            .setAttribute('search', [collectionId, name].join(' ')));

        await dbForProject.updateCollection('database_' + database.getInternalId() + '_collection_' + collection.getInternalId(), permissions, documentSecurity);

        queueForEvents
            .setContext('database', database)
            .setParam('databaseId', databaseId)
            .setParam('collectionId', collection.getId());

        response.dynamic(collection, Response.MODEL_COLLECTION);
    });

App.delete('/v1/databases/:databaseId/collections/:collectionId')
    //.alias('/v1/database/collections/:collectionId', { databaseId: 'default' })
    .desc('Delete collection')
    .groups(['api', 'database', 'schema'])
    .label('scope', 'collections.write')
    .label('event', 'databases.[databaseId].collections.[collectionId].delete')
    .label('audits.event', 'collection.delete')
    .label('audits.resource', 'database/{request.databaseId}/collection/{request.collectionId}')
    .label('sdk.auth', [APP_AUTH_TYPE_KEY])
    .label('sdk.namespace', 'databases')
    .label('sdk.method', 'deleteCollection')
    .label('sdk.description', '/docs/references/databases/delete-collection.md')
    .label('sdk.response.code', Response.STATUS_CODE_NOCONTENT)
    .label('sdk.response.model', Response.MODEL_NONE)
    .param('databaseId', '', new UID(), 'Database ID.')
    .param('collectionId', '', new UID(), 'Collection ID.')
    .inject('response')
    .inject('dbForProject')
    .inject('queueForDatabase')
    .inject('queueForEvents')
    .inject('mode')
    .action(async ({ databaseId, collectionId, response, dbForProject, queueForDatabase, queueForEvents, mode }: { databaseId: string, collectionId: string, response: Response, dbForProject: Database, queueForDatabase: EventDatabase, queueForEvents: Event, mode: string }) => {

        const database = await Authorization.skip(() => dbForProject.getDocument('databases', databaseId));

        if (database.isEmpty()) {
            throw new Exception(Exception.DATABASE_NOT_FOUND);
        }

        const collection = await dbForProject.getDocument('database_' + database.getInternalId(), collectionId);

        if (collection.isEmpty()) {
            throw new Exception(Exception.COLLECTION_NOT_FOUND);
        }

        if (!await dbForProject.deleteDocument('database_' + database.getInternalId(), collectionId)) {
            throw new Exception(Exception.GENERAL_SERVER_ERROR, 'Failed to remove collection from DB');
        }

        dbForProject.purgeCachedCollection('database_' + database.getInternalId() + '_collection_' + collection.getInternalId());

        queueForDatabase
            .setType(DATABASE_TYPE_DELETE_COLLECTION)
            .setDatabase(database)
            .setCollection(collection);

        queueForEvents
            .setContext('database', database)
            .setParam('databaseId', databaseId)
            .setParam('collectionId', collection.getId())
            .setPayload(response.output(collection, Response.MODEL_COLLECTION));

        response.noContent();
    });