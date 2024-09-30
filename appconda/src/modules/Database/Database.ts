import { Cache } from 'Utopia/Cache/Cache';
import {
    DatabaseException, AuthorizationException, ConflictException, DuplicateException,
    LimitException, QueryException, RelationshipException, RestrictedException,
    StructureException, TimeoutException
} from 'Utopia/Database/Exception';
import { ID, Permission, Role } from 'Utopia/Database/Helpers';
import { Authorization, Input } from 'Utopia/Database/Validator/Authorization';
import { IndexValidator, Permissions, DocumentValidator, DocumentsValidator, Structure } from 'Utopia/Database/Validator';
import { Adapter } from './Adapter';

class Database {
    public static readonly VAR_STRING = 'string';
    // Simple Types
    public static readonly VAR_INTEGER = 'integer';
    public static readonly VAR_FLOAT = 'double';
    public static readonly VAR_BOOLEAN = 'boolean';
    public static readonly VAR_DATETIME = 'datetime';

    public static readonly INT_MAX = 2147483647;
    public static readonly BIG_INT_MAX = Number.MAX_SAFE_INTEGER;
    public static readonly DOUBLE_MAX = Number.MAX_VALUE;

    // Relationship Types
    public static readonly VAR_RELATIONSHIP = 'relationship';

    // Index Types
    public static readonly INDEX_KEY = 'key';
    public static readonly INDEX_FULLTEXT = 'fulltext';
    public static readonly INDEX_UNIQUE = 'unique';
    public static readonly INDEX_SPATIAL = 'spatial';
    public static readonly ARRAY_INDEX_LENGTH = 255;

    // Relation Types
    public static readonly RELATION_ONE_TO_ONE = 'oneToOne';
    public static readonly RELATION_ONE_TO_MANY = 'oneToMany';
    public static readonly RELATION_MANY_TO_ONE = 'manyToOne';
    public static readonly RELATION_MANY_TO_MANY = 'manyToMany';

    // Relation Actions
    public static readonly RELATION_MUTATE_CASCADE = 'cascade';
    public static readonly RELATION_MUTATE_RESTRICT = 'restrict';
    public static readonly RELATION_MUTATE_SET_NULL = 'setNull';

    // Relation Sides
    public static readonly RELATION_SIDE_PARENT = 'parent';
    public static readonly RELATION_SIDE_CHILD = 'child';

    public static readonly RELATION_MAX_DEPTH = 3;

    // Orders
    public static readonly ORDER_ASC = 'ASC';
    public static readonly ORDER_DESC = 'DESC';

    // Permissions
    public static readonly PERMISSION_CREATE = 'create';
    public static readonly PERMISSION_READ = 'read';
    public static readonly PERMISSION_UPDATE = 'update';
    public static readonly PERMISSION_DELETE = 'delete';

    // Aggregate permissions
    public static readonly PERMISSION_WRITE = 'write';

    public static readonly PERMISSIONS = [
        Database.PERMISSION_CREATE,
        Database.PERMISSION_READ,
        Database.PERMISSION_UPDATE,
        Database.PERMISSION_DELETE,
    ];

    // Collections
    public static readonly METADATA = '_metadata';

    // Cursor
    public static readonly CURSOR_BEFORE = 'before';
    public static readonly CURSOR_AFTER = 'after';

    // Lengths
    public static readonly LENGTH_KEY = 255;

    // Cache
    public static readonly TTL = 60 * 60 * 24; // 24 hours

    // Events
    public static readonly EVENT_ALL = '*';

    public static readonly EVENT_DATABASE_LIST = 'database_list';
    public static readonly EVENT_DATABASE_CREATE = 'database_create';
    public static readonly EVENT_DATABASE_DELETE = 'database_delete';

    public static readonly EVENT_COLLECTION_LIST = 'collection_list';
    public static readonly EVENT_COLLECTION_CREATE = 'collection_create';
    public static readonly EVENT_COLLECTION_UPDATE = 'collection_update';
    public static readonly EVENT_COLLECTION_READ = 'collection_read';
    public static readonly EVENT_COLLECTION_DELETE = 'collection_delete';

    public static readonly EVENT_DOCUMENT_FIND = 'document_find';
    public static readonly EVENT_DOCUMENT_CREATE = 'document_create';
    public static readonly EVENT_DOCUMENTS_CREATE = 'documents_create';
    public static readonly EVENT_DOCUMENT_READ = 'document_read';
    public static readonly EVENT_DOCUMENT_UPDATE = 'document_update';
    public static readonly EVENT_DOCUMENTS_UPDATE = 'documents_update';
    public static readonly EVENT_DOCUMENT_DELETE = 'document_delete';
    public static readonly EVENT_DOCUMENT_COUNT = 'document_count';
    public static readonly EVENT_DOCUMENT_SUM = 'document_sum';
    public static readonly EVENT_DOCUMENT_INCREASE = 'document_increase';
    public static readonly EVENT_DOCUMENT_DECREASE = 'document_decrease';

    public static readonly EVENT_PERMISSIONS_CREATE = 'permissions_create';
    public static readonly EVENT_PERMISSIONS_READ = 'permissions_read';
    public static readonly EVENT_PERMISSIONS_DELETE = 'permissions_delete';

    public static readonly EVENT_ATTRIBUTE_CREATE = 'attribute_create';
    public static readonly EVENT_ATTRIBUTE_UPDATE = 'attribute_update';
    public static readonly EVENT_ATTRIBUTE_DELETE = 'attribute_delete';

    public static readonly EVENT_INDEX_RENAME = 'index_rename';
    public static readonly EVENT_INDEX_CREATE = 'index_create';
    public static readonly EVENT_INDEX_DELETE = 'index_delete';

    public static readonly INSERT_BATCH_SIZE = 100;

    protected adapter: Adapter;

    protected cache: Cache;

    protected cacheName: string = 'default';

    protected map: Array<boolean | string> = [];

    public static readonly INTERNAL_ATTRIBUTES: Array<{ [key: string]: any }> = [
        {
            '$id': '$id',
            'type': Database.VAR_STRING,
            'size': Database.LENGTH_KEY,
            'required': true,
            'signed': true,
            'array': false,
            'filters': [],
        },
        {
            '$id': '$internalId',
            'type': Database.VAR_STRING,
            'size': Database.LENGTH_KEY,
            'required': true,
            'signed': true,
            'array': false,
            'filters': [],
        },
        {
            '$id': '$collection',
            'type': Database.VAR_STRING,
            'size': Database.LENGTH_KEY,
            'required': true,
            'signed': true,
            'array': false,
            'filters': [],
        },
        {
            '$id': '$tenant',
            'type': Database.VAR_INTEGER,
            'size': 0,
            'required': false,
            'default': null,
            'signed': true,
            'array': false,
            'filters': [],
        },
        {
            '$id': '$createdAt',
            'type': Database.VAR_DATETIME,
            'format': '',
            'size': 0,
            'signed': false,
            'required': false,
            'default': null,
            'array': false,
            'filters': ['datetime']
        },
        {
            '$id': '$updatedAt',
            'type': Database.VAR_DATETIME,
            'format': '',
            'size': 0,
            'signed': false,
            'required': false,
            'default': null,
            'array': false,
            'filters': ['datetime']
        },
        {
            '$id': '$permissions',
            'type': Database.VAR_STRING,
            'size': 1000000,
            'signed': true,
            'required': false,
            'default': [],
            'array': false,
            'filters': ['json']
        },
    ];

    public static readonly INTERNAL_INDEXES: string[] = [
        '_id',
        '_uid',
        '_createdAt',
        '_updatedAt',
        '_permissions_id',
        '_permissions',
    ];

    protected static readonly COLLECTION: { [key: string]: any } = {
        '$id': Database.METADATA,
        '$collection': Database.METADATA,
        'name': 'collections',
        'attributes': [
            {
                '$id': 'name',
                'key': 'name',
                'type': Database.VAR_STRING,
                'size': 256,
                'required': true,
                'signed': true,
                'array': false,
                'filters': [],
            },
            {
                '$id': 'attributes',
                'key': 'attributes',
                'type': Database.VAR_STRING,
                'size': 1000000,
                'required': false,
                'signed': true,
                'array': false,
                'filters': ['json'],
            },
            {
                '$id': 'indexes',
                'key': 'indexes',
                'type': Database.VAR_STRING,
                'size': 1000000,
                'required': false,
                'signed': true,
                'array': false,
                'filters': ['json'],
            },
            {
                '$id': 'documentSecurity',
                'key': 'documentSecurity',
                'type': Database.VAR_BOOLEAN,
                'size': 0,
                'required': true,
                'signed': true,
                'array': false,
                'filters': []
            }
        ],
        'indexes': [],
    };


    protected static filters: any[] = [];

    protected instanceFilters: any[] = [];

    protected listeners: { [key: string]: any[] } = {
        '*': [],
    };

    protected silentListeners: any[] | null = null;

    protected timestamp: Date | null = null;

    protected resolveRelationships: boolean = true;

    protected relationshipFetchDepth: number = 1;

    protected filter: boolean = true;

    protected validate: boolean = true;

    protected preserveDates: boolean = false;

    protected relationshipWriteStack: any[] = [];

    protected relationshipFetchStack: any[] = [];

    protected relationshipDeleteStack: any[] = [];

    private authorization!: Authorization;

    constructor(adapter: Adapter, cache: Cache, filters: { [key: string]: { encode: (value: any) => any, decode: (value: any) => any } } = {}) {
        this.adapter = adapter;
        this.cache = cache;
        this.instanceFilters = filters;

        this.setAuthorization(new Authorization());

        Database.addFilter(
            'json',
            (value: any) => {
                value = (value instanceof Document) ? value.getArrayCopy() : value;

                if (!Array.isArray(value) && !(value instanceof Object)) {
                    return value;
                }

                return JSON.stringify(value);
            },
            (value: any) => {
                if (typeof value !== 'string') {
                    return value;
                }

                value = JSON.parse(value) ?? [];

                if ('$id' in value) {
                    return new Document(value);
                } else {
                    value = value.map((item: any) => {
                        if (Array.isArray(item) && '$id' in item) {
                            return new Document(item);
                        }
                        return item;
                    });
                }

                return value;
            }
        );

        Database.addFilter(
            'datetime',
            (value: string | null) => {
                if (value === null) {
                    return null;
                }
                try {
                    const date = new Date(value);
                    date.setTime(date.getTime() + date.getTimezoneOffset() * 60 * 1000);
                    return DateTime.format(date);
                } catch (error) {
                    return value;
                }
            },
            (value: string | null) => {
                return DateTime.formatTz(value);
            }
        );
    }

    setAuthorization(authorization: Authorization): this {
        this.adapter.setAuthorization(authorization);
        this.authorization = authorization;
        return this;
    }

    getAuthorization(): Authorization {
        return this.authorization;
    }

    on(event: string, name: string, callback: Function): this {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event][name] = callback;

        return this;
    }

    before(event: string, name: string, callback: Function): this {
        this.adapter.before(event, name, callback);

        return this;
    }

    silent<T>(callback: () => T, listeners: string[] | null = null): T {
        const previous = this.silentListeners;

        if (listeners === null) {
            this.silentListeners = null;
        } else {
            const silentListeners: { [key: string]: boolean } = {};
            for (const listener of listeners) {
                silentListeners[listener] = true;
            }
            this.silentListeners = silentListeners;
        }

        try {
            return callback();
        } finally {
            this.silentListeners = previous;
        }
    }

    skipRelationships<T>(callback: () => T): T {
        const previous = this.resolveRelationships;
        this.resolveRelationships = false;

        try {
            return callback();
        } finally {
            this.resolveRelationships = previous;
        }
    }

    protected trigger(event: string, args: any = null): void {
        if (this.silentListeners === null) {
            return;
        }
        for (const [name, callback] of Object.entries(this.listeners[Database.EVENT_ALL] || {})) {
            if (this.silentListeners[name]) {
                continue;
            }
            callback(event, args);
        }

        for (const [name, callback] of Object.entries(this.listeners[event] || {})) {
            if (this.silentListeners[name]) {
                continue;
            }
            callback(event, args);
        }
    }

    withRequestTimestamp<T>(requestTimestamp: Date | null, callback: () => T): T {
        const previous = this.timestamp;
        this.timestamp = requestTimestamp;
        try {
            return callback();
        } finally {
            this.timestamp = previous;
        }
    }

    setNamespace(namespace: string): this {
        this.adapter.setNamespace(namespace);
        return this;
    }

    getNamespace(): string {
        return this.adapter.getNamespace();
    }

    setDatabase(name: string): this {
        this.adapter.setDatabase(name);
        return this;
    }

    getDatabase(): string {
        return this.adapter.getDatabase();
    }

    setCache(cache: Cache): this {
        this.cache = cache;
        return this;
    }

    getCache(): Cache {
        return this.cache;
    }

    setCacheName(name: string): this {
        this.cacheName = name;
        return this;
    }
    getCacheName(): string {
        return this.cacheName;
    }

    setMetadata(key: string, value: any): this {
        this.adapter.setMetadata(key, value);
        return this;
    }

    getMetadata(): { [key: string]: any } {
        return this.adapter.getMetadata();
    }

    resetMetadata(): void {
        this.adapter.resetMetadata();
    }

    setTimeout(milliseconds: number, event: string = Database.EVENT_ALL): this {
        this.adapter.setTimeout(milliseconds, event);
        return this;
    }

    clearTimeout(event: string = Database.EVENT_ALL): void {
        this.adapter.clearTimeout(event);
    }

    enableFilters(): this {
        this.filter = true;
        return this;
    }

    disableFilters(): this {
        this.filter = false;
        return this;
    }

    getInstanceFilters(): { [key: string]: { encode: (value: any) => any, decode: (value: any) => any } } {
        return this.instanceFilters;
    }

    enableValidation(): this {
        this.validate = true;
        return this;
    }

    disableValidation(): this {
        this.validate = false;
        return this;
    }

    skipValidation<T>(callback: () => T): T {
        const initial = this.validate;
        this.disableValidation();

        try {
            return callback();
        } finally {
            this.validate = initial;
        }
    }

    setSharedTables(sharedTables: boolean): this {
        this.adapter.setSharedTables(sharedTables);
        return this;
    }

    setTenant(tenant: number | null): this {
        this.adapter.setTenant(tenant);
        return this;
    }

    setPreserveDates(preserve: boolean): this {
        this.preserveDates = preserve;
        return this;
    }

    getKeywords(): string[] {
        return this.adapter.getKeywords();
    }

    getAdapter(): Adapter {
        return this.adapter;
    }

    startTransaction(): boolean {
        return this.adapter.startTransaction();
    }

    commitTransaction(): boolean {
        return this.adapter.commitTransaction();
    }

    rollbackTransaction(): boolean {
        return this.adapter.rollbackTransaction();
    }

    withTransaction<T>(callback: () => T): T {
        return this.adapter.withTransaction(callback);
    }

    ping(): boolean {
        return this.adapter.ping();
    }

    create(database: string | null = null): boolean {
        if (this.adapter.getSharedTables() && !this.adapter.getTenant()) {
            throw new DatabaseException('Missing tenant. Tenant must be set when table sharing is enabled.');
        }

        database = database ?? this.adapter.getDatabase();
        this.adapter.create(database);

        const attributes = self.COLLECTION['attributes'].map((attribute: any) => new Document(attribute));

        this.silent(() => this.createCollection(self.METADATA, attributes));

        this.trigger(self.EVENT_DATABASE_CREATE, database);

        return true;
    }

    exists(database: string | null = null, collection: string | null = null): boolean {
        if (this.adapter.getSharedTables() && !this.adapter.getTenant()) {
            throw new DatabaseException('Missing tenant. Tenant must be set when table sharing is enabled.');
        }

        database = database ?? this.adapter.getDatabase();

        return this.adapter.exists(database, collection);
    }

    list(): Document[] {
        if (this.adapter.getSharedTables() && !this.adapter.getTenant()) {
            throw new DatabaseException('Missing tenant. Tenant must be set when table sharing is enabled.');
        }

        const databases = this.adapter.list();

        this.trigger(self.EVENT_DATABASE_LIST, databases);

        return databases;
    }

    delete(database: string | null = null): boolean {
        if (this.adapter.getSharedTables() && !this.adapter.getTenant()) {
            throw new DatabaseException('Missing tenant. Tenant must be set when table sharing is enabled.');
        }

        database = database ?? this.adapter.getDatabase();

        const deleted = this.adapter.delete(database);

        this.trigger(self.EVENT_DATABASE_DELETE, {
            name: database,
            deleted: deleted
        });

        return deleted;
    }


    createCollection(id: string, attributes: Document[] = [], indexes: Document[] = [], permissions: string[] | null = null, documentSecurity: boolean = true): Document {
        if (this.adapter.getSharedTables() && !this.adapter.getTenant()) {
            throw new DatabaseException('Missing tenant. Tenant must be set when table sharing is enabled.');
        }

        permissions ??= [
            Permission.create(Role.any()),
        ];

        if (this.validate) {
            const validator = new Permissions();
            if (!validator.isValid(permissions)) {
                throw new DatabaseException(validator.getDescription());
            }
        }

        let collection = this.silent(() => this.getCollection(id));

        if (!collection.isEmpty() && id !== Database.METADATA) {
            throw new DuplicateException('Collection ' + id + ' already exists');
        }

        collection = new Document({
            '$id': ID.custom(id),
            '$permissions': permissions,
            'name': id,
            'attributes': attributes,
            'indexes': indexes,
            'documentSecurity': documentSecurity
        });

        if (this.validate) {
            const validator = new IndexValidator(
                attributes,
                this.adapter.getMaxIndexLength()
            );
            for (const index of indexes) {
                if (!validator.isValid(index)) {
                    throw new DatabaseException(validator.getDescription());
                }
            }
        }

        this.adapter.createCollection(id, attributes, indexes);

        if (id === Database.METADATA) {
            return new Document(Database.COLLECTION);
        }

        if (indexes && this.adapter.getCountOfIndexes(collection) > this.adapter.getLimitForIndexes()) {
            throw new LimitException('Index limit of ' + this.adapter.getLimitForIndexes() + ' exceeded. Cannot create collection.');
        }

        if (attributes) {
            if (
                this.adapter.getLimitForAttributes() > 0 &&
                this.adapter.getCountOfAttributes(collection) > this.adapter.getLimitForAttributes()
            ) {
                throw new LimitException('Column limit of ' + this.adapter.getLimitForAttributes() + ' exceeded. Cannot create collection.');
            }

            if (
                this.adapter.getDocumentSizeLimit() > 0 &&
                this.adapter.getAttributeWidth(collection) > this.adapter.getDocumentSizeLimit()
            ) {
                throw new LimitException('Row width limit of ' + this.adapter.getDocumentSizeLimit() + ' exceeded. Cannot create collection.');
            }
        }

        const createdCollection = this.silent(() => this.createDocument(Database.METADATA, collection));

        this.trigger(Database.EVENT_COLLECTION_CREATE, createdCollection);

        return createdCollection;
    }

    updateCollection(id: string, permissions: string[], documentSecurity: boolean): Document {
        if (this.adapter.getSharedTables() && !this.adapter.getTenant()) {
            throw new DatabaseException('Missing tenant. Tenant must be set when table sharing is enabled.');
        }

        if (this.validate) {
            const validator = new Permissions();
            if (!validator.isValid(permissions)) {
                throw new DatabaseException(validator.getDescription());
            }
        }

        let collection = this.silent(() => this.getCollection(id));

        if (collection.isEmpty()) {
            throw new DatabaseException('Collection not found');
        }

        if (
            this.adapter.getSharedTables() &&
            collection.getAttribute('$tenant') != this.adapter.getTenant()
        ) {
            throw new DatabaseException('Collection not found');
        }

        collection
            .setAttribute('$permissions', permissions)
            .setAttribute('documentSecurity', documentSecurity);

        collection = this.silent(() => this.updateDocument(Database.METADATA, collection.getId(), collection));

        this.trigger(Database.EVENT_COLLECTION_UPDATE, collection);

        return collection;
    }

    getCollection(id: string): Document {
        if (this.adapter.getSharedTables() && !this.adapter.getTenant()) {
            throw new DatabaseException('Missing tenant. Tenant must be set when table sharing is enabled.');
        }

        const collection = this.silent(() => this.getDocument(Database.METADATA, id));

        if (
            id !== Database.METADATA &&
            this.adapter.getSharedTables() &&
            collection.getAttribute('$tenant') != this.adapter.getTenant()
        ) {
            return new Document();
        }

        this.trigger(Database.EVENT_COLLECTION_READ, collection);

        return collection;
    }

    listCollections(limit: number = 25, offset: number = 0): Document[] {
        if (this.adapter.getSharedTables() && !this.adapter.getTenant()) {
            throw new DatabaseException('Missing tenant. Tenant must be set when table sharing is enabled.');
        }

        let result = this.silent(() => this.find(Database.METADATA, [
            Query.limit(limit),
            Query.offset(offset)
        ]));

        if (this.adapter.getSharedTables()) {
            result = result.filter((collection: Document) => {
                return collection.getAttribute('$tenant') == this.adapter.getTenant();
            });
        }

        this.trigger(Database.EVENT_COLLECTION_LIST, result);

        return result;
    }

    getSizeOfCollection(collection: string): number {
        if (this.adapter.getSharedTables() && !this.adapter.getTenant()) {
            throw new DatabaseException('Missing tenant. Tenant must be set when table sharing is enabled.');
        }

        const collectionDoc = this.silent(() => this.getCollection(collection));

        if (collectionDoc.isEmpty()) {
            throw new DatabaseException('Collection not found');
        }

        if (this.adapter.getSharedTables() && collectionDoc.getAttribute('$tenant') != this.adapter.getTenant()) {
            throw new DatabaseException('Collection not found');
        }

        return this.adapter.getSizeOfCollection(collectionDoc.getId());
    }

    deleteCollection(id: string): boolean {
        if (this.adapter.getSharedTables() && !this.adapter.getTenant()) {
            throw new DatabaseException('Missing tenant. Tenant must be set when table sharing is enabled.');
        }

        const collection = this.silent(() => this.getDocument(Database.METADATA, id));

        if (collection.isEmpty()) {
            throw new DatabaseException('Collection not found');
        }

        if (this.adapter.getSharedTables() && collection.getAttribute('$tenant') != this.adapter.getTenant()) {
            throw new DatabaseException('Collection not found');
        }

        const relationships = collection.getAttribute('attributes').filter((attribute: any) =>
            attribute.getAttribute('type') === Database.VAR_RELATIONSHIP
        );

        for (const relationship of relationships) {
            this.deleteRelationship(collection.getId(), relationship.getId());
        }

        this.adapter.deleteCollection(id);

        let deleted: boolean;
        if (id === Database.METADATA) {
            deleted = true;
        } else {
            deleted = this.silent(() => this.deleteDocument(Database.METADATA, id));
        }

        if (deleted) {
            this.trigger(Database.EVENT_COLLECTION_DELETE, collection);
        }

        return deleted;
    }

    createAttribute(
        collection: string,
        id: string,
        type: string,
        size: number,
        required: boolean,
        defaultValue: any = null,
        signed: boolean = true,
        array: boolean = false,
        format: string | null = null,
        formatOptions: { [key: string]: any } = {},
        filters: string[] = []
    ): boolean {
        if (this.adapter.getSharedTables() && !this.adapter.getTenant()) {
            throw new DatabaseException('Missing tenant. Tenant must be set when table sharing is enabled.');
        }

        const collectionDoc = this.silent(() => this.getCollection(collection));

        if (collectionDoc.isEmpty()) {
            throw new DatabaseException('Collection not found');
        }

        if (this.adapter.getSharedTables() && collectionDoc.getAttribute('$tenant') != this.adapter.getTenant()) {
            throw new DatabaseException('Collection not found');
        }

        const attributes = collectionDoc.getAttribute('attributes', []);
        for (const attribute of attributes) {
            if (attribute.getId().toLowerCase() === id.toLowerCase()) {
                throw new DuplicateException('Attribute already exists');
            }
        }

        const requiredFilters = this.getRequiredFilters(type);
        if (requiredFilters.some(filter => !filters.includes(filter))) {
            throw new DatabaseException(`Attribute of type: ${type} requires the following filters: ${requiredFilters.join(",")}`);
        }

        if (
            this.adapter.getLimitForAttributes() > 0 &&
            this.adapter.getCountOfAttributes(collectionDoc) >= this.adapter.getLimitForAttributes()
        ) {
            throw new LimitException('Column limit reached. Cannot create new attribute.');
        }

        if (format && !Structure.hasFormat(format, type)) {
            throw new DatabaseException(`Format ("${format}") not available for this attribute type ("${type}")`);
        }

        const attribute = new Document({
            '$id': ID.custom(id),
            'key': id,
            'type': type,
            'size': size,
            'required': required,
            'default': defaultValue,
            'signed': signed,
            'array': array,
            'format': format,
            'formatOptions': formatOptions,
            'filters': filters,
        });

        collectionDoc.setAttribute('attributes', attribute, Document.SET_TYPE_APPEND);

        if (
            this.adapter.getDocumentSizeLimit() > 0 &&
            this.adapter.getAttributeWidth(collectionDoc) >= this.adapter.getDocumentSizeLimit()
        ) {
            throw new LimitException('Row width limit reached. Cannot create new attribute.');
        }

        switch (type) {
            case Database.VAR_STRING:
                if (size > this.adapter.getLimitForString()) {
                    throw new DatabaseException(`Max size allowed for string is: ${this.adapter.getLimitForString()}`);
                }
                break;
            case Database.VAR_INTEGER:
                const limit = signed ? this.adapter.getLimitForInt() / 2 : this.adapter.getLimitForInt();
                if (size > limit) {
                    throw new DatabaseException(`Max size allowed for int is: ${limit}`);
                }
                break;
            case Database.VAR_FLOAT:
            case Database.VAR_BOOLEAN:
            case Database.VAR_DATETIME:
            case Database.VAR_RELATIONSHIP:
                break;
            default:
                throw new DatabaseException(`Unknown attribute type: ${type}. Must be one of ${Database.VAR_STRING}, ${Database.VAR_INTEGER}, ${Database.VAR_FLOAT}, ${Database.VAR_BOOLEAN}, ${Database.VAR_DATETIME}, ${Database.VAR_RELATIONSHIP}`);
        }

        if (defaultValue !== null) {
            if (required) {
                throw new DatabaseException('Cannot set a default value on a required attribute');
            }

            this.validateDefaultTypes(type, defaultValue);
        }

        try {
            const created = this.adapter.createAttribute(collectionDoc.getId(), id, type, size, signed, array);

            if (!created) {
                throw new DatabaseException('Failed to create attribute');
            }
        } catch (e) {
            if (!(e instanceof DuplicateException) || !this.adapter.getSharedTables()) {
                throw e;
            }
        }

        if (collectionDoc.getId() !== Database.METADATA) {
            this.silent(() => this.updateDocument(Database.METADATA, collectionDoc.getId(), collectionDoc));
        }

        this.purgeCachedCollection(collectionDoc.getId());
        this.purgeCachedDocument(Database.METADATA, collectionDoc.getId());

        this.trigger(Database.EVENT_ATTRIBUTE_CREATE, attribute);

        return true;
    }

    protected getRequiredFilters(type: string | null): string[] {
        switch (type) {
            case Database.VAR_DATETIME:
                return ['datetime'];
            default:
                return [];
        }
    }

    protected validateDefaultTypes(type: string, defaultValue: any): void {
        const defaultType = typeof defaultValue;

        if (defaultType === 'undefined' || defaultType === 'object' && defaultValue === null) {
            // Disable null. No validation required
            return;
        }

        if (Array.isArray(defaultValue)) {
            for (const value of defaultValue) {
                this.validateDefaultTypes(type, value);
            }
            return;
        }

        switch (type) {
            case Database.VAR_STRING:
            case Database.VAR_INTEGER:
            case Database.VAR_FLOAT:
            case Database.VAR_BOOLEAN:
                if (type !== defaultType) {
                    throw new DatabaseException(`Default value ${defaultValue} does not match given type ${type}`);
                }
                break;
            case Database.VAR_DATETIME:
                if (defaultType !== 'string') {
                    throw new DatabaseException(`Default value ${defaultValue} does not match given type ${type}`);
                }
                break;
            default:
                throw new DatabaseException(`Unknown attribute type: ${type}. Must be one of ${Database.VAR_STRING}, ${Database.VAR_INTEGER}, ${Database.VAR_FLOAT}, ${Database.VAR_BOOLEAN}, ${Database.VAR_DATETIME}, ${Database.VAR_RELATIONSHIP}`);
        }
    }

    protected updateIndexMeta(collection: string, id: string, updateCallback: (index: Document, collection: Document, indexPosition: number) => void): Document {
        if (this.adapter.getSharedTables() && !this.adapter.getTenant()) {
            throw new DatabaseException('Missing tenant. Tenant must be set when table sharing is enabled.');
        }

        const collectionDoc = this.silent(() => this.getCollection(collection));

        if (collectionDoc.getId() === Database.METADATA) {
            throw new DatabaseException('Cannot update metadata indexes');
        }

        const indexes = collectionDoc.getAttribute('indexes', []);
        const indexPosition = indexes.findIndex((index: Document) => index.getAttribute('$id') === id);

        if (indexPosition === -1) {
            throw new DatabaseException('Index not found');
        }

        // Execute update from callback
        updateCallback(indexes[indexPosition], collectionDoc, indexPosition);

        // Save
        collectionDoc.setAttribute('indexes', indexes);

        this.silent(() => this.updateDocument(Database.METADATA, collectionDoc.getId(), collectionDoc));

        this.trigger(Database.EVENT_ATTRIBUTE_UPDATE, indexes[indexPosition]);

        return indexes[indexPosition];
    }

    protected updateAttributeMeta(collection: string, id: string, updateCallback: (attribute: Document, collection: Document, attributeIndex: number) => void): Document {
        if (this.adapter.getSharedTables() && !this.adapter.getTenant()) {
            throw new DatabaseException('Missing tenant. Tenant must be set when table sharing is enabled.');
        }

        const collectionDoc = this.silent(() => this.getCollection(collection));

        if (collectionDoc.getId() === Database.METADATA) {
            throw new DatabaseException('Cannot update metadata attributes');
        }

        const attributes = collectionDoc.getAttribute('attributes', []);
        const attributeIndex = attributes.findIndex((attribute: Document) => attribute.getAttribute('$id') === id);

        if (attributeIndex === -1) {
            throw new DatabaseException('Attribute not found');
        }

        // Execute update from callback
        updateCallback(attributes[attributeIndex], collectionDoc, attributeIndex);

        // Save
        collectionDoc.setAttribute('attributes', attributes, Document.SET_TYPE_ASSIGN);

        this.silent(() => this.updateDocument(Database.METADATA, collectionDoc.getId(), collectionDoc));

        this.trigger(Database.EVENT_ATTRIBUTE_UPDATE, attributes[attributeIndex]);

        return attributes[attributeIndex];
    }

    updateAttributeRequired(collection: string, id: string, required: boolean): Document {
        return this.updateAttributeMeta(collection, id, (attribute) => {
            attribute.setAttribute('required', required);
        });
    }

    updateAttributeFormat(collection: string, id: string, format: string): Document {
        return this.updateAttributeMeta(collection, id, (attribute) => {
            if (!Structure.hasFormat(format, attribute.getAttribute('type'))) {
                throw new DatabaseException(`Format "${format}" not available for attribute type "${attribute.getAttribute('type')}"`);
            }

            attribute.setAttribute('format', format);
        });
    }

    updateAttributeFormatOptions(collection: string, id: string, formatOptions: { [key: string]: any }): Document {
        return this.updateAttributeMeta(collection, id, (attribute) => {
            attribute.setAttribute('formatOptions', formatOptions);
        });
    }

    updateAttributeFilters(collection: string, id: string, filters: string[]): Document {
        return this.updateAttributeMeta(collection, id, (attribute) => {
            attribute.setAttribute('filters', filters);
        });
    }

    updateAttributeDefault(collection: string, id: string, defaultValue: any = null): Document {
        return this.updateAttributeMeta(collection, id, (attribute) => {
            if (attribute.getAttribute('required') === true) {
                throw new DatabaseException('Cannot set a default value on a required attribute');
            }

            this.validateDefaultTypes(attribute.getAttribute('type'), defaultValue);

            attribute.setAttribute('default', defaultValue);
        });
    }

    updateAttribute(
        collection: string,
        id: string,
        type: string | null = null,
        size: number | null = null,
        required: boolean | null = null,
        defaultValue: any = null,
        signed: boolean | null = null,
        array: boolean | null = null,
        format: string | null = null,
        formatOptions: { [key: string]: any } | null = null,
        filters: string[] | null = null,
        newKey: string | null = null
    ): Document {
        return this.updateAttributeMeta(collection, id, (attribute, collectionDoc, attributeIndex) => {
            const altering = type !== null || size !== null || signed !== null || array !== null || newKey !== null;
            type = type ?? attribute.getAttribute('type');
            size = size ?? attribute.getAttribute('size');
            signed = signed ?? attribute.getAttribute('signed');
            required = required ?? attribute.getAttribute('required');
            defaultValue = defaultValue ?? attribute.getAttribute('default');
            array = array ?? attribute.getAttribute('array');
            format = format ?? attribute.getAttribute('format');
            formatOptions = formatOptions ?? attribute.getAttribute('formatOptions');
            filters = filters ?? attribute.getAttribute('filters');

            if (required === true && defaultValue !== null) {
                defaultValue = null;
            }

            switch (type) {
                case Database.VAR_STRING:
                    if (!size) {
                        throw new DatabaseException('Size length is required');
                    }

                    if (size > this.adapter.getLimitForString()) {
                        throw new DatabaseException(`Max size allowed for string is: ${this.adapter.getLimitForString()}`);
                    }
                    break;

                case Database.VAR_INTEGER:
                    const limit = signed ? this.adapter.getLimitForInt() / 2 : this.adapter.getLimitForInt();
                    if (size > limit) {
                        throw new DatabaseException(`Max size allowed for int is: ${limit}`);
                    }
                    break;
                case Database.VAR_FLOAT:
                case Database.VAR_BOOLEAN:
                case Database.VAR_DATETIME:
                    if (size) {
                        throw new DatabaseException('Size must be empty');
                    }
                    break;
                default:
                    throw new DatabaseException(`Unknown attribute type: ${type}. Must be one of ${Database.VAR_STRING}, ${Database.VAR_INTEGER}, ${Database.VAR_FLOAT}, ${Database.VAR_BOOLEAN}, ${Database.VAR_DATETIME}, ${Database.VAR_RELATIONSHIP}`);
            }

            const requiredFilters = this.getRequiredFilters(type);
            if (requiredFilters.some(filter => !filters.includes(filter))) {
                throw new DatabaseException(`Attribute of type: ${type} requires the following filters: ${requiredFilters.join(",")}`);
            }

            if (format && !Structure.hasFormat(format, type)) {
                throw new DatabaseException(`Format ("${format}") not available for this attribute type ("${type}")`);
            }

            if (defaultValue !== null) {
                if (required) {
                    throw new DatabaseException('Cannot set a default value on a required attribute');
                }

                this.validateDefaultTypes(type, defaultValue);
            }

            attribute
                .setAttribute('$id', newKey ?? id)
                .setAttribute('key', newKey ?? id)
                .setAttribute('type', type)
                .setAttribute('size', size)
                .setAttribute('signed', signed)
                .setAttribute('array', array)
                .setAttribute('format', format)
                .setAttribute('formatOptions', formatOptions)
                .setAttribute('filters', filters)
                .setAttribute('required', required)
                .setAttribute('default', defaultValue);

            const attributes = collectionDoc.getAttribute('attributes');
            attributes[attributeIndex] = attribute;
            collectionDoc.setAttribute('attributes', attributes, Document.SET_TYPE_ASSIGN);

            if (
                this.adapter.getDocumentSizeLimit() > 0 &&
                this.adapter.getAttributeWidth(collectionDoc) >= this.adapter.getDocumentSizeLimit()
            ) {
                throw new LimitException('Row width limit reached. Cannot create new attribute.');
            }

            if (altering) {
                const updated = this.adapter.updateAttribute(collection, id, type, size, signed, array, newKey);

                if (id !== newKey) {
                    const indexes = collectionDoc.getAttribute('indexes');

                    for (const index of indexes) {
                        if (index.attributes.includes(id)) {
                            index.attributes = index.attributes.map((attribute: string) => attribute === id ? newKey : attribute);
                        }
                    }
                }

                if (!updated) {
                    throw new DatabaseException('Failed to update attribute');
                }

                this.purgeCachedCollection(collection);
            }

            this.purgeCachedDocument(Database.METADATA, collection);
        });
    }

    checkAttribute(collection: Document, attribute: Document): boolean {
        if (this.adapter.getSharedTables() && !this.adapter.getTenant()) {
            throw new DatabaseException('Missing tenant. Tenant must be set when table sharing is enabled.');
        }

        const collectionClone = collection.clone();

        collectionClone.setAttribute('attributes', attribute, Document.SET_TYPE_APPEND);

        if (
            this.adapter.getLimitForAttributes() > 0 &&
            this.adapter.getCountOfAttributes(collectionClone) > this.adapter.getLimitForAttributes()
        ) {
            throw new LimitException('Column limit reached. Cannot create new attribute.');
        }

        if (
            this.adapter.getDocumentSizeLimit() > 0 &&
            this.adapter.getAttributeWidth(collectionClone) >= this.adapter.getDocumentSizeLimit()
        ) {
            throw new LimitException('Row width limit reached. Cannot create new attribute.');
        }

        return true;
    }

    deleteAttribute(collection: string, id: string): boolean {
        if (this.adapter.getSharedTables() && !this.adapter.getTenant()) {
            throw new DatabaseException('Missing tenant. Tenant must be set when table sharing is enabled.');
        }

        const collectionDoc = this.silent(() => this.getCollection(collection));
        const attributes = collectionDoc.getAttribute('attributes', []);
        const indexes = collectionDoc.getAttribute('indexes', []);

        let attribute: Document | null = null;

        for (const [key, value] of attributes.entries()) {
            if (value['$id'] === id) {
                attribute = value;
                attributes.splice(key, 1);
                break;
            }
        }

        if (!attribute) {
            throw new DatabaseException('Attribute not found');
        }

        if (attribute.getAttribute('type') === Database.VAR_RELATIONSHIP) {
            throw new DatabaseException('Cannot delete relationship as an attribute');
        }

        for (const index of indexes) {
            const indexAttributes = index.getAttribute('attributes', []);

            const filteredAttributes = indexAttributes.filter((attr: string) => attr !== id);

            if (filteredAttributes.length === 0) {
                indexes.splice(indexes.indexOf(index), 1);
            } else {
                index.setAttribute('attributes', filteredAttributes);
            }
        }

        const deleted = this.adapter.deleteAttribute(collectionDoc.getId(), id);

        if (!deleted) {
            throw new DatabaseException('Failed to delete attribute');
        }

        collectionDoc.setAttribute('attributes', attributes);
        collectionDoc.setAttribute('indexes', indexes);

        if (collectionDoc.getId() !== Database.METADATA) {
            this.silent(() => this.updateDocument(Database.METADATA, collectionDoc.getId(), collectionDoc));
        }

        this.purgeCachedCollection(collectionDoc.getId());
        this.purgeCachedDocument(Database.METADATA, collectionDoc.getId());

        this.trigger(Database.EVENT_ATTRIBUTE_DELETE, attribute);

        return true;
    }

    renameAttribute(collection: string, old: string, new: string): boolean {
        if (this.adapter.getSharedTables() && !this.adapter.getTenant()) {
            throw new DatabaseException('Missing tenant. Tenant must be set when table sharing is enabled.');
        }

        const collectionDoc = this.silent(() => this.getCollection(collection));
        const attributes = collectionDoc.getAttribute('attributes', []);
        const indexes = collectionDoc.getAttribute('indexes', []);

        const attributeExists = attributes.some((attribute: Document) => attribute.getAttribute('$id') === old);

        if (!attributeExists) {
            throw new DatabaseException('Attribute not found');
        }

        const newAttributeExists = attributes.some((attribute: Document) => attribute.getAttribute('$id') === new);

        if (newAttributeExists) {
            throw new DuplicateException('Attribute name already used');
        }

        for (const attribute of attributes) {
            if (attribute.getAttribute('$id') === old) {
                attribute.setAttribute('key', new);
                attribute.setAttribute('$id', new);
                break;
            }
        }

        for (const index of indexes) {
            const indexAttributes = index.getAttribute('attributes', []);
            const updatedAttributes = indexAttributes.map((attribute: string) => (attribute === old) ? new : attribute);
            index.setAttribute('attributes', updatedAttributes);
        }

        collectionDoc.setAttribute('attributes', attributes);
        collectionDoc.setAttribute('indexes', indexes);

        if (collectionDoc.getId() !== Database.METADATA) {
            this.silent(() => this.updateDocument(Database.METADATA, collectionDoc.getId(), collectionDoc));
        }

        const renamed = this.adapter.renameAttribute(collectionDoc.getId(), old, new);

        this.trigger(Database.EVENT_ATTRIBUTE_UPDATE, attributes.find((attribute: Document) => attribute.getAttribute('$id') === new));

        return renamed;
    }

    createRelationship(
        collection: string,
        relatedCollection: string,
        type: string,
        twoWay: boolean = false,
        id: string | null = null,
        twoWayKey: string | null = null,
        onDelete: string = Database.RELATION_MUTATE_RESTRICT
    ): boolean {
        if (this.adapter.getSharedTables() && !this.adapter.getTenant()) {
            throw new DatabaseException('Missing tenant. Tenant must be set when table sharing is enabled.');
        }

        const collectionDoc = this.silent(() => this.getCollection(collection));

        if (collectionDoc.isEmpty()) {
            throw new DatabaseException('Collection not found');
        }

        const relatedCollectionDoc = this.silent(() => this.getCollection(relatedCollection));

        if (relatedCollectionDoc.isEmpty()) {
            throw new DatabaseException('Related collection not found');
        }

        id ??= relatedCollectionDoc.getId();
        twoWayKey ??= collectionDoc.getId();

        const attributes = collectionDoc.getAttribute('attributes', []);
        for (const attribute of attributes) {
            if (attribute.getAttribute('$id').toLowerCase() === id.toLowerCase()) {
                throw new DuplicateException('Attribute already exists');
            }

            if (
                attribute.getAttribute('type') === Database.VAR_RELATIONSHIP &&
                attribute.getAttribute('options').twoWayKey.toLowerCase() === twoWayKey.toLowerCase() &&
                attribute.getAttribute('options').relatedCollection === relatedCollectionDoc.getId()
            ) {
                throw new DuplicateException('Related attribute already exists');
            }
        }

        if (
            this.adapter.getLimitForAttributes() > 0 &&
            (this.adapter.getCountOfAttributes(collectionDoc) >= this.adapter.getLimitForAttributes() ||
                this.adapter.getCountOfAttributes(relatedCollectionDoc) >= this.adapter.getLimitForAttributes())
        ) {
            throw new LimitException('Column limit reached. Cannot create new attribute.');
        }

        if (
            this.adapter.getDocumentSizeLimit() > 0 &&
            (this.adapter.getAttributeWidth(collectionDoc) >= this.adapter.getDocumentSizeLimit() ||
                this.adapter.getAttributeWidth(relatedCollectionDoc) >= this.adapter.getDocumentSizeLimit())
        ) {
            throw new LimitException('Row width limit reached. Cannot create new attribute.');
        }

        const relationship = new Document({
            '$id': ID.custom(id),
            'key': id,
            'type': Database.VAR_RELATIONSHIP,
            'required': false,
            'default': null,
            'options': {
                'relatedCollection': relatedCollectionDoc.getId(),
                'relationType': type,
                'twoWay': twoWay,
                'twoWayKey': twoWayKey,
                'onDelete': onDelete,
                'side': Database.RELATION_SIDE_PARENT,
            },
        });

        const twoWayRelationship = new Document({
            '$id': ID.custom(twoWayKey),
            'key': twoWayKey,
            'type': Database.VAR_RELATIONSHIP,
            'required': false,
            'default': null,
            'options': {
                'relatedCollection': collectionDoc.getId(),
                'relationType': type,
                'twoWay': twoWay,
                'twoWayKey': id,
                'onDelete': onDelete,
                'side': Database.RELATION_SIDE_CHILD,
            },
        });

        collectionDoc.setAttribute('attributes', relationship, Document.SET_TYPE_APPEND);
        relatedCollectionDoc.setAttribute('attributes', twoWayRelationship, Document.SET_TYPE_APPEND);

        if (type === Database.RELATION_MANY_TO_MANY) {
            this.silent(() => this.createCollection(`_${collectionDoc.getInternalId()}_${relatedCollectionDoc.getInternalId()}`, [
                new Document({
                    '$id': id,
                    'key': id,
                    'type': Database.VAR_STRING,
                    'size': Database.LENGTH_KEY,
                    'required': true,
                    'signed': true,
                    'array': false,
                    'filters': [],
                }),
                new Document({
                    '$id': twoWayKey,
                    'key': twoWayKey,
                    'type': Database.VAR_STRING,
                    'size': Database.LENGTH_KEY,
                    'required': true,
                    'signed': true,
                    'array': false,
                    'filters': [],
                }),
            ], [
                new Document({
                    '$id': `_index_${id}`,
                    'key': `index_${id}`,
                    'type': Database.INDEX_KEY,
                    'attributes': [id],
                }),
                new Document({
                    '$id': `_index_${twoWayKey}`,
                    'key': `_index_${twoWayKey}`,
                    'type': Database.INDEX_KEY,
                    'attributes': [twoWayKey],
                }),
            ]));
        }

        const created = this.adapter.createRelationship(
            collectionDoc.getId(),
            relatedCollectionDoc.getId(),
            type,
            twoWay,
            id,
            twoWayKey
        );

        if (!created) {
            throw new DatabaseException('Failed to create relationship');
        }

        this.silent(() => {
            this.updateDocument(Database.METADATA, collectionDoc.getId(), collectionDoc);
            this.updateDocument(Database.METADATA, relatedCollectionDoc.getId(), relatedCollectionDoc);

            const indexKey = `_index_${id}`;
            const twoWayIndexKey = `_index_${twoWayKey}`;

            switch (type) {
                case Database.RELATION_ONE_TO_ONE:
                    this.createIndex(collectionDoc.getId(), indexKey, Database.INDEX_UNIQUE, [id]);
                    if (twoWay) {
                        this.createIndex(relatedCollectionDoc.getId(), twoWayIndexKey, Database.INDEX_UNIQUE, [twoWayKey]);
                    }
                    break;
                case Database.RELATION_ONE_TO_MANY:
                    this.createIndex(relatedCollectionDoc.getId(), twoWayIndexKey, Database.INDEX_KEY, [twoWayKey]);
                    break;
                case Database.RELATION_MANY_TO_ONE:
                    this.createIndex(collectionDoc.getId(), indexKey, Database.INDEX_KEY, [id]);
                    break;
                case Database.RELATION_MANY_TO_MANY:
                    // Indexes created on junction collection creation
                    break;
                default:
                    throw new RelationshipException('Invalid relationship type.');
            }
        });

        this.trigger(Database.EVENT_ATTRIBUTE_CREATE, relationship);

        return true;
    }

    updateRelationship(
        collection: string,
        id: string,
        newKey: string | null = null,
        newTwoWayKey: string | null = null,
        twoWay: boolean | null = null,
        onDelete: string | null = null
    ): boolean {
        if (this.adapter.getSharedTables() && !this.adapter.getTenant()) {
            throw new DatabaseException('Missing tenant. Tenant must be set when table sharing is enabled.');
        }

        if (!newKey && !newTwoWayKey && !twoWay && !onDelete) {
            return true;
        }

        const collectionDoc = this.getCollection(collection);
        const attributes = collectionDoc.getAttribute('attributes', []);

        if (newKey && attributes.some((attribute: Document) => attribute.getAttribute('key') === newKey)) {
            throw new DuplicateException('Attribute already exists');
        }

        this.updateAttributeMeta(collectionDoc.getId(), id, (attribute, collectionDoc, attributeIndex) => {
            const altering = (newKey && newKey !== id) || (newTwoWayKey && newTwoWayKey !== attribute.getAttribute('options').twoWayKey);

            const relatedCollectionId = attribute.getAttribute('options').relatedCollection;
            const relatedCollectionDoc = this.getCollection(relatedCollectionId);
            const relatedAttributes = relatedCollectionDoc.getAttribute('attributes', []);

            if (newTwoWayKey && relatedAttributes.some((attribute: Document) => attribute.getAttribute('key') === newTwoWayKey)) {
                throw new DuplicateException('Related attribute already exists');
            }

            const type = attribute.getAttribute('options').relationType;
            const side = attribute.getAttribute('options').side;

            newKey ??= attribute.getAttribute('key');
            const twoWayKey = attribute.getAttribute('options').twoWayKey;
            newTwoWayKey ??= attribute.getAttribute('options').twoWayKey;
            twoWay ??= attribute.getAttribute('options').twoWay;
            onDelete ??= attribute.getAttribute('options').onDelete;

            attribute.setAttribute('$id', newKey);
            attribute.setAttribute('key', newKey);
            attribute.setAttribute('options', {
                relatedCollection: relatedCollectionDoc.getId(),
                relationType: type,
                twoWay: twoWay,
                twoWayKey: newTwoWayKey,
                onDelete: onDelete,
                side: side,
            });

            this.updateAttributeMeta(relatedCollectionDoc.getId(), twoWayKey, (twoWayAttribute) => {
                const options = twoWayAttribute.getAttribute('options', {});
                options.twoWayKey = newKey;
                options.twoWay = twoWay;
                options.onDelete = onDelete;

                twoWayAttribute.setAttribute('$id', newTwoWayKey);
                twoWayAttribute.setAttribute('key', newTwoWayKey);
                twoWayAttribute.setAttribute('options', options);
            });

            if (type === Database.RELATION_MANY_TO_MANY) {
                const junction = this.getJunctionCollection(collectionDoc, relatedCollectionDoc, side);

                this.updateAttributeMeta(junction, id, (junctionAttribute) => {
                    junctionAttribute.setAttribute('$id', newKey);
                    junctionAttribute.setAttribute('key', newKey);
                });
                this.updateAttributeMeta(junction, twoWayKey, (junctionAttribute) => {
                    junctionAttribute.setAttribute('$id', newTwoWayKey);
                    junctionAttribute.setAttribute('key', newTwoWayKey);
                });

                this.purgeCachedCollection(junction);
            }

            if (altering) {
                const updated = this.adapter.updateRelationship(
                    collectionDoc.getId(),
                    relatedCollectionDoc.getId(),
                    type,
                    twoWay,
                    id,
                    twoWayKey,
                    side,
                    newKey,
                    newTwoWayKey
                );

                if (!updated) {
                    throw new DatabaseException('Failed to update relationship');
                }
            }

            this.purgeCachedCollection(collectionDoc.getId());
            this.purgeCachedCollection(relatedCollectionDoc.getId());

            const renameIndex = (collection: string, key: string, newKey: string) => {
                this.updateIndexMeta(
                    collection,
                    `_index_${key}`,
                    (index) => index.setAttribute('attributes', [newKey])
                );
                this.silent(() => this.renameIndex(collection, `_index_${key}`, `_index_${newKey}`));
            };

            switch (type) {
                case Database.RELATION_ONE_TO_ONE:
                    if (id !== newKey) {
                        renameIndex(collectionDoc.getId(), id, newKey);
                    }
                    if (twoWay && twoWayKey !== newTwoWayKey) {
                        renameIndex(relatedCollectionDoc.getId(), twoWayKey, newTwoWayKey);
                    }
                    break;
                case Database.RELATION_ONE_TO_MANY:
                    if (side === Database.RELATION_SIDE_PARENT) {
                        if (twoWayKey !== newTwoWayKey) {
                            renameIndex(relatedCollectionDoc.getId(), twoWayKey, newTwoWayKey);
                        }
                    } else {
                        if (id !== newKey) {
                            renameIndex(collectionDoc.getId(), id, newKey);
                        }
                    }
                    break;
                case Database.RELATION_MANY_TO_ONE:
                    if (side === Database.RELATION_SIDE_PARENT) {
                        if (id !== newKey) {
                            renameIndex(collectionDoc.getId(), id, newKey);
                        }
                    } else {
                        if (twoWayKey !== newTwoWayKey) {
                            renameIndex(relatedCollectionDoc.getId(), twoWayKey, newTwoWayKey);
                        }
                    }
                    break;
                case Database.RELATION_MANY_TO_MANY:
                    const junction = this.getJunctionCollection(collectionDoc, relatedCollectionDoc, side);

                    if (id !== newKey) {
                        renameIndex(junction, id, newKey);
                    }
                    if (twoWayKey !== newTwoWayKey) {
                        renameIndex(junction, twoWayKey, newTwoWayKey);
                    }
                    break;
                default:
                    throw new RelationshipException('Invalid relationship type.');
            }
        });

        return true;
    }


}