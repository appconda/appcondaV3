import { DatabaseException } from '../exceptions/DatabaseException';
import { DuplicateException } from '../exceptions/DuplicateException';
import { TimeoutException } from '../exceptions/TimeoutException';
import { Authorization } from '../validators/Authorization';
import { Document } from '../document';
import { Query } from '../query';

export abstract class Adapter {
    protected database: string = '';
    protected namespace: string = '';
    protected sharedTables: boolean = false;
    protected tenant: number | null = null;
    protected inTransaction: number = 0;

    protected debug: Record<string, any> = {};
    protected transformations: Record<string, Record<string, CallableFunction>> = {
        '*': {},
    };
    protected metadata: Record<string, any> = {};
    protected authorization!: Authorization;

    /**
     * Set Authorization.
     *
     * @param authorization Authorization instance
     * @returns this
     */
    public setAuthorization(authorization: Authorization): this {
        this.authorization = authorization;
        return this;
    }

    /**
     * Clear all transformations.
     *
     * @returns this
     */
    public clearTransformations(): this {
        this.transformations = {
            '*': {},
        };
        return this;
    }

    /**
     * Set a debug key-value pair.
     *
     * @param key Debug key
     * @param value Debug value
     * @returns this
     */
    public setDebug(key: string, value: any): this {
        this.debug[key] = value;
        return this;
    }

    /**
     * Get all debug information.
     *
     * @returns Debug information
     */
    public getDebug(): Record<string, any> {
        return this.debug;
    }

    /**
     * Reset all debug information.
     *
     * @returns this
     */
    public resetDebug(): this {
        this.debug = {};
        return this;
    }

    /**
     * Set Namespace.
     *
     * @param namespace Namespace string
     * @returns boolean
     * @throws DatabaseException
     */
    public setNamespace(namespace: string): boolean {
        this.namespace = this.filter(namespace);
        return true;
    }

    /**
     * Get Namespace.
     *
     * @returns Namespace string
     */
    public getNamespace(): string {
        return this.namespace;
    }

    /**
     * Set Database.
     *
     * @param name Database name
     * @returns boolean
     * @throws DatabaseException
     */
    public setDatabase(name: string): boolean {
        this.database = this.filter(name);
        return true;
    }

    /**
     * Get Database.
     *
     * @returns Database name
     * @throws DatabaseException
     */
    public getDatabase(): string {
        if (this.database === '') {
            throw new DatabaseException('Missing database. Database must be set before use.');
        }
        return this.database;
    }

    /**
     * Set Shared Tables flag.
     *
     * @param sharedTables boolean flag
     * @returns boolean
     */
    public setSharedTables(sharedTables: boolean): boolean {
        this.sharedTables = sharedTables;
        return true;
    }

    /**
     * Get Shared Tables flag.
     *
     * @returns boolean
     */
    public getSharedTables(): boolean {
        return this.sharedTables;
    }

    /**
     * Set Tenant.
     *
     * @param tenant Tenant ID or null
     * @returns boolean
     */
    public setTenant(tenant: number | null): boolean {
        this.tenant = tenant;
        return true;
    }

    /**
     * Get Tenant.
     *
     * @returns Tenant ID or null
     */
    public getTenant(): number | null {
        return this.tenant;
    }

    /**
     * Set metadata for query comments.
     *
     * @param key Metadata key
     * @param value Metadata value
     * @returns this
     */
    public setMetadata(key: string, value: any): this {
        this.metadata[key] = value;

        let output = '';
        for (const [k, v] of Object.entries(this.metadata)) {
            output += `/* ${k}: ${v} */\n`;
        }

        this.before(Database.EVENT_ALL, 'metadata', (query: string) => {
            return output + query;
        });

        return this;
    }

    /**
     * Get metadata.
     *
     * @returns Metadata object
     */
    public getMetadata(): Record<string, any> {
        return this.metadata;
    }

    /**
     * Reset all metadata.
     *
     * @returns this
     */
    public resetMetadata(): this {
        this.metadata = {};
        return this;
    }

    /**
     * Check if a transaction is active.
     *
     * @returns boolean
     * @throws DatabaseException
     */
    public isInTransaction(): boolean {
        return this.inTransaction > 0;
    }

    /**
     * Execute a callback within a transaction.
     *
     * @template T
     * @param callback Function to execute
     * @returns The result of the callback
     * @throws Error
     */
    public withTransaction<T>(callback: () => T): T {
        this.startTransaction();

        try {
            const result = callback();
            this.commitTransaction();
            return result;
        } catch (e) {
            this.rollbackTransaction();
            throw e;
        }
    }

    /**
     * Apply a transformation to a query before an event occurs.
     *
     * @param event Event name
     * @param name Transformation name
     * @param callback Transformation function or null to remove
     * @returns this
     */
    public before(event: string, name: string = '', callback: CallableFunction | null = null): this {
        if (!this.transformations[event]) {
            this.transformations[event] = {};
        }

        if (callback === null) {
            delete this.transformations[event][name];
        } else {
            this.transformations[event][name] = callback;
        }

        return this;
    }

    /**
     * Trigger all transformations for a given event.
     *
     * @param event Event name
     * @param query Query string or object
     * @returns Transformed query
     */
    protected trigger(event: string, query: any): any {
        for (const callback of Object.values(this.transformations['*'] || {})) {
            query = callback(query);
        }
        for (const callback of Object.values(this.transformations[event] || {})) {
            query = callback(query);
        }
        return query;
    }

    /**
     * Filter Keys.
     *
     * @param value String to filter
     * @returns Filtered string
     * @throws DatabaseException
     */
    public filter(value: string): string {
        const filtered = value.replace(/[^A-Za-z0-9_\-]/g, '');
        if (filtered === null) {
            throw new DatabaseException('Failed to filter key');
        }
        return filtered;
    }

    /**
     * Escape Wildcards in a string.
     *
     * @param value String with potential wildcards
     * @returns Escaped string
     */
    public escapeWildcards(value: string): string {
        const wildcards = ['%', '_', '[', ']', '^', '-', '.', '*', '+', '?', '(', ')', '{', '}', '|'];
        for (const wildcard of wildcards) {
            value = value.replace(new RegExp(`\\${wildcard}`, 'g'), `\\${wildcard}`);
        }
        return value;
    }

    /**
     * Abstract Methods to be Implemented by Subclasses
     */

    /**
     * Start a new transaction.
     *
     * @returns boolean
     * @throws DatabaseException
     */
    public abstract startTransaction(): Promise<boolean>;

    /**
     * Commit a transaction.
     *
     * @returns boolean
     * @throws DatabaseException
     */
    public abstract commitTransaction(): Promise<boolean>;

    /**
     * Rollback a transaction.
     *
     * @returns boolean
     * @throws DatabaseException
     */
    public abstract rollbackTransaction(): Promise<boolean>;

    /**
     * Ping Database.
     *
     * @returns boolean
     */
    public abstract ping(): Promise<boolean>;

    /**
     * Create Database.
     *
     * @param name Database name
     * @returns boolean
     */
    public abstract create(name: string): Promise<boolean>;

    /**
     * Check if a database or collection exists.
     *
     * @param database Database name
     * @param collection Optional collection name
     * @returns boolean
     */
    public abstract exists(database: string, collection?: string | null): Promise<boolean>;

    /**
     * List Databases.
     *
     * @returns Array of Documents
     */
    public abstract list(): Promise<Document[]>;

    /**
     * Delete Database.
     *
     * @param name Database name
     * @returns boolean
     */
    public abstract delete(name: string): Promise<boolean>;

    /**
     * Create Collection.
     *
     * @param name Collection name
     * @param attributes Optional array of Documents for attributes
     * @param indexes Optional array of Documents for indexes
     * @returns boolean
     */
    public abstract createCollection(name: string, attributes?: Document[], indexes?: Document[]): Promise<boolean>;

    /**
     * Delete Collection.
     *
     * @param id Collection ID
     * @returns boolean
     */
    public abstract deleteCollection(id: string): Promise<boolean>;

    /**
     * Create Attribute.
     *
     * @param collection Collection name
     * @param id Attribute ID
     * @param type Attribute type
     * @param size Attribute size
     * @param signed Whether the attribute is signed
     * @param array Whether the attribute is an array
     * @returns boolean
     * @throws TimeoutException
     * @throws DuplicateException
     */
    public abstract createAttribute(
        collection: string,
        id: string,
        type: string,
        size: number,
        signed: boolean ,
        array: boolean 
    ): Promise<boolean>;

    /**
     * Update Attribute.
     *
     * @param collection Collection name
     * @param id Attribute ID
     * @param type Attribute type
     * @param size Attribute size
     * @param signed Whether the attribute is signed
     * @param array Whether the attribute is an array
     * @param newKey New key for the attribute
     * @returns boolean
     */
    public abstract updateAttribute(
        collection: string,
        id: string,
        type: string,
        size: number,
        signed: boolean ,
        array: boolean ,
        newKey: string | null 
    ): Promise<boolean>;

    /**
     * Delete Attribute.
     *
     * @param collection Collection name
     * @param id Attribute ID
     * @returns boolean
     */
    public abstract deleteAttribute(collection: string, id: string): Promise<boolean>;

    /**
     * Rename Attribute.
     *
     * @param collection Collection name
     * @param old Old attribute name
     * @param new New attribute name
     * @returns boolean
     */
    public abstract renameAttribute(collection: string, old: string, newKey: string): Promise<boolean>;

    /**
     * Create Relationship.
     *
     * @param collection Collection name
     * @param relatedCollection Related collection name
     * @param type Relationship type
     * @param twoWay Whether the relationship is two-way
     * @param id Relationship ID
     * @param twoWayKey Two-way relationship key
     * @returns boolean
     */
    public abstract createRelationship(
        collection: string,
        relatedCollection: string,
        type: string,
        twoWay: boolean,
        id: string ,
        twoWayKey: string 
    ): Promise<boolean>;

    /**
     * Update Relationship.
     *
     * @param collection Collection name
     * @param relatedCollection Related collection name
     * @param type Relationship type
     * @param twoWay Whether the relationship is two-way
     * @param key Relationship key
     * @param twoWayKey Two-way relationship key
     * @param side Side of the relationship
     * @param newKey New key for the relationship
     * @param newTwoWayKey New two-way relationship key
     * @returns boolean
     */
    public abstract updateRelationship(
        collection: string,
        relatedCollection: string,
        type: string,
        twoWay: boolean,
        key: string,
        twoWayKey: string,
        side: string,
        newKey: string | null,
        newTwoWayKey: string | null 
    ): Promise<boolean>;

    /**
     * Delete Relationship.
     *
     * @param collection Collection name
     * @param relatedCollection Related collection name
     * @param type Relationship type
     * @param twoWay Whether the relationship is two-way
     * @param key Relationship key
     * @param twoWayKey Two-way relationship key
     * @param side Side of the relationship
     * @returns boolean
     */
    public abstract deleteRelationship(
        collection: string,
        relatedCollection: string,
        type: string,
        twoWay: boolean,
        key: string,
        twoWayKey: string,
        side: string
    ): Promise<boolean>;

    /**
     * Rename Index.
     *
     * @param collection Collection name
     * @param old Old index name
     * @param new New index name
     * @returns boolean
     */
    public abstract renameIndex(collection: string, old: string, newKey: string): Promise<boolean>;

    /**
     * Create Index.
     *
     * @param collection Collection name
     * @param id Index ID
     * @param type Index type
     * @param attributes Array of attribute names
     * @param lengths Array of lengths
     * @param orders Array of order types
     * @returns boolean
     */
    public abstract createIndex(
        collection: string,
        id: string,
        type: string,
        attributes: string[],
        lengths: number[],
        orders: string[]
    ): Promise<boolean>;

    /**
     * Delete Index.
     *
     * @param collection Collection name
     * @param id Index ID
     * @returns boolean
     */
    public abstract deleteIndex(collection: string, id: string): Promise<boolean>;

    /**
     * Get Document.
     *
     * @param collection Collection name
     * @param id Document ID
     * @param queries Array of Query objects
     * @param forUpdate Whether to lock the document for update
     * @returns Document
     */
    public abstract getDocument(
        collection: string,
        id: string,
        queries: Query[],
        forUpdate: boolean 
    ): Promise<Document>;

    /**
     * Create Document.
     *
     * @param collection Collection name
     * @param document Document object
     * @returns Document
     */
    public abstract createDocument(collection: string, document: Document): Promise<Document>;

    /**
     * Create Documents in batches.
     *
     * @param collection Collection name
     * @param documents Array of Document objects
     * @param batchSize Size of each batch
     * @returns Array of Document objects
     * @throws DatabaseException
     */
    public abstract createDocuments(
        collection: string,
        documents: Document[],
        batchSize: number
    ): Promise<Document[]>;

    /**
     * Update Document.
     *
     * @param collection Collection name
     * @param document Document object
     * @returns Document
     */
    public abstract updateDocument(collection: string, document: Document): Promise<Document>;

    /**
     * Update Documents in batches.
     *
     * @param collection Collection name
     * @param documents Array of Document objects
     * @param batchSize Size of each batch
     * @returns Array of Document objects
     * @throws DatabaseException
     */
    public abstract updateDocuments(
        collection: string,
        documents: Document[],
        batchSize: number
    ): Promise<Document[]>;

    /**
     * Delete Document.
     *
     * @param collection Collection name
     * @param id Document ID
     * @returns boolean
     */
    public abstract deleteDocument(collection: string, id: string): Promise<boolean>;

    /**
     * Find Documents.
     *
     * @param collection Collection name
     * @param queries Array of Query objects
     * @param limit Maximum number of documents to return
     * @param offset Offset for pagination
     * @param orderAttributes Array of attributes to order by
     * @param orderTypes Array of order types (ASC/DESC)
     * @param cursor Cursor data
     * @param cursorDirection Cursor direction
     * @returns Array of Document objects
     */
    public abstract find(
        collection: string,
        queries: Query[] ,
        limit: number | null ,
        offset: number | null ,
        orderAttributes: string[] ,
        orderTypes: string[],
        cursor: Record<string, any> ,
        cursorDirection: string 
    ): Promise<Document[]>;

    /**
     * Sum an attribute.
     *
     * @param collection Collection name
     * @param attribute Attribute name
     * @param queries Array of Query objects
     * @param max Maximum value
     * @returns number
     */
    public abstract sum(
        collection: string,
        attribute: string,
        queries: Query[],
        max: number | null 
    ): Promise<number>;

    /**
     * Count Documents.
     *
     * @param collection Collection name
     * @param queries Array of Query objects
     * @param max Maximum count
     * @returns number
     */
    public abstract count(
        collection: string,
        queries: Query[] ,
        max: number | null 
    ): Promise<number>;

    /**
     * Get Collection Size.
     *
     * @param collection Collection name
     * @returns number
     * @throws DatabaseException
     */
    public abstract getSizeOfCollection(collection: string): Promise<number>;

    /**
     * Get max STRING limit.
     *
     * @returns number
     */
    public abstract getLimitForString(): Promise<number>;

    /**
     * Get max INT limit.
     *
     * @returns number
     */
    public abstract getLimitForInt(): Promise<number>;

    /**
     * Get maximum attributes limit.
     *
     * @returns number
     */
    public abstract getLimitForAttributes(): Promise<number>;

    /**
     * Get maximum index limit.
     *
     * @returns number
     */
    public abstract getLimitForIndexes(): Promise<number>;

    /**
     * Check if schemas are supported.
     *
     * @returns boolean
     */
    public abstract getSupportForSchemas(): Promise<boolean>;

    /**
     * Check if attributes are supported.
     *
     * @returns boolean
     */
    public abstract getSupportForAttributes(): Promise<boolean>;

    /**
     * Check if index is supported.
     *
     * @returns boolean
     */
    public abstract getSupportForIndex(): Promise<boolean>;

    /**
     * Check if unique index is supported.
     *
     * @returns boolean
     */
    public abstract getSupportForUniqueIndex(): Promise<boolean>;

    /**
     * Check if fulltext index is supported.
     *
     * @returns boolean
     */
    public abstract getSupportForFulltextIndex(): Promise<boolean>;

    /**
     * Check if fulltext wildcard index is supported.
     *
     * @returns boolean
     */
    public abstract getSupportForFulltextWildcardIndex(): Promise<boolean>;

    /**
     * Check if casting is handled by the adapter.
     *
     * @returns boolean
     */
    public abstract getSupportForCasting(): Promise<boolean>;

    /**
     * Check if query contains is handled by the adapter.
     *
     * @returns boolean
     */
    public abstract getSupportForQueryContains(): Promise<boolean>;

    /**
     * Check if timeouts are supported.
     *
     * @returns boolean
     */
    public abstract getSupportForTimeouts(): Promise<boolean>;

    /**
     * Check if relationships are supported.
     *
     * @returns boolean
     */
    public abstract getSupportForRelationships(): Promise<boolean>;

    /**
     * Check if update locks are supported.
     *
     * @returns boolean
     */
    public abstract getSupportForUpdateLock(): Promise<boolean>;

    /**
     * Check if attribute resizing is supported.
     *
     * @returns boolean
     */
    public abstract getSupportForAttributeResizing(): Promise<boolean>;

    /**
     * Get current attribute count from a collection.
     *
     * @param collection Collection Document
     * @returns number
     */
    public abstract getCountOfAttributes(collection: Document): Promise<number>;

    /**
     * Get current index count from a collection.
     *
     * @param collection Collection Document
     * @returns number
     */
    public abstract getCountOfIndexes(collection: Document): Promise<number>;

    /**
     * Get the default count of attributes.
     *
     * @returns number
     */
    //public static abstract getCountOfDefaultAttributes(): number;

    /**
     * Get the default count of indexes.
     *
     * @returns number
     */
    //public static abstract getCountOfDefaultIndexes(): number;

    /**
     * Get maximum width, in bytes, allowed for a SQL row.
     *
     * @returns number
     */
    //public static abstract getDocumentSizeLimit(): number;

    /**
     * Estimate maximum number of bytes required to store a document in a collection.
     *
     * @param collection Collection Document
     * @returns number
     */
    public abstract getAttributeWidth(collection: Document): Promise<number>;

    /**
     * Get list of keywords that cannot be used.
     *
     * @returns array of keywords
     */
    public abstract getKeywords(): Promise<string[]>;

    /**
     * Get an attribute projection given a list of selected attributes.
     *
     * @param selections Array of selected attributes
     * @param prefix Optional prefix for attributes
     * @returns Projection string or object
     */
    protected abstract getAttributeProjection(selections: string[], prefix?: string): Promise<any>;

    /**
     * Get all selected attributes from queries.
     *
     * @param queries Array of Query objects
     * @returns Array of selected attributes
     */
    protected getAttributeSelections(queries: Query[]): string[] {
        const selections: string[] = [];

        for (const query of queries) {
            if (query.getMethod() === Query.TYPE_SELECT) {
                for (const value of query.getValues()) {
                    selections.push(value);
                }
            }
        }

        return selections;
    }

    /**
     * Increase or decrease an attribute value of a document.
     *
     * @param collection Collection name
     * @param id Document ID
     * @param attribute Attribute name
     * @param value Value to increase or decrease
     * @param updatedAt Updated at timestamp
     * @param min Minimum value
     * @param max Maximum value
     * @returns boolean
     * @throws Error
     */
    public abstract increaseDocumentAttribute(
        collection: string,
        id: string,
        attribute: string,
        value: number,
        updatedAt: string,
        min: number | null ,
        max: number | null 
    ): Promise<boolean>;

    /**
     * Get maximum index length.
     *
     * @returns number
     */
    public abstract getMaxIndexLength(): Promise<number>;

    /**
     * Set a global timeout for database queries in milliseconds.
     *
     * @param milliseconds Timeout value in milliseconds
     * @param event Event name
     * @returns void
     * @throws Error
     */
    public abstract setTimeout(milliseconds: number, event: string ): Promise<void>;

    /**
     * Clears a global timeout for database queries.
     *
     * @param event Event name
     * @returns void
     */
    public clearTimeout(event: string): void {
        // Clear existing callback
        this.before(event, 'timeout', null);
    }
}