import { Adapter } from '../Adapter'; // Assume Adapter is a base class you have implemented
import { DatabaseException } from '../exceptions/DatabaseException';
import { DuplicateException } from '../exceptions/DuplicateException';
import { TimeoutException } from '../exceptions/TimeoutException';
import { TruncateException } from '../exceptions/TruncateException';
import { Document } from '../document';
import { Query } from '../query';
import { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';

export abstract class SQL extends Adapter {
    protected pdo: Pool;
    protected inTransaction: number = 0;

    constructor(pdo: Pool) {
        super();
        this.pdo = pdo;
    }

    /**
     * Start Transaction
     *
     * @returns Promise<boolean>
     * @throws DatabaseException
     */
    async startTransaction(): Promise<boolean> {
        try {
            if (this.inTransaction === 0) {
                await this.pdo.getConnection().then(conn => conn.beginTransaction());
            }
            this.inTransaction++;
            return true;
        } catch (e: any) {
            throw new DatabaseException(`Failed to start transaction: ${e.message}`, e.code, e);
        }
    }

    /**
     * Commit Transaction
     *
     * @returns Promise<boolean>
     * @throws DatabaseException
     */
    async commitTransaction(): Promise<boolean> {
        if (this.inTransaction === 0) {
            return false;
        } else if (this.inTransaction > 1) {
            this.inTransaction--;
            return true;
        }

        try {
            await this.pdo.getConnection().then(conn => conn.commit());
            this.inTransaction--;
            return true;
        } catch (e: any) {
            this.inTransaction--;
            throw new DatabaseException(`Failed to commit transaction: ${e.message}`, e.code, e);
        }
    }

    /**
     * Rollback Transaction
     *
     * @returns Promise<boolean>
     * @throws DatabaseException
     */
    async rollbackTransaction(): Promise<boolean> {
        if (this.inTransaction === 0) {
            return false;
        }

        try {
            await this.pdo.getConnection().then(conn => conn.rollback());
            this.inTransaction = 0;
            return true;
        } catch (e: any) {
            this.inTransaction = 0;
            throw new DatabaseException(`Failed to rollback transaction: ${e.message}`, e.code, e);
        }
    }

    /**
     * Ping Database
     *
     * @returns Promise<boolean>
     * @throws DatabaseException
     */
    async ping(): Promise<boolean> {
        try {
            const rows = await this.pdo.query('SELECT 1;');
            return rows.length > 0;
        } catch (e: any) {
            throw new DatabaseException(`Ping failed: ${e.message}`, e.code, e);
        }
    }

    /**
     * Check if Database or Collection Exists
     *
     * @param database string
     * @param collection string | null
     * @returns Promise<boolean>
     * @throws DatabaseException
     */
    async exists(database: string, collection: string | null = null): Promise<boolean> {
        database = this.filter(database);

        let sql: string;
        let params: any = {};

        if (collection !== null) {
            collection = this.filter(collection);
            sql = `
                SELECT TABLE_NAME 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_SCHEMA = :schema 
                  AND TABLE_NAME = :table
            `;
            params = { schema: database, table: `${this.getNamespace()}_${collection}` };
        } else {
            sql = `
                SELECT SCHEMA_NAME 
                FROM INFORMATION_SCHEMA.SCHEMATA
                WHERE SCHEMA_NAME = :schema
            `;
            params = { schema: database };
        }

        try {
            const [rows] = await this.pdo.execute<RowDataPacket[]>(sql, params);
            return rows.length > 0;
        } catch (e: any) {
            throw new DatabaseException(`Exists check failed: ${e.message}`, e.code, e);
        }
    }

    /**
     * List Databases (Implement as needed)
     *
     * @returns Promise<Document[]>
     */
    async list(): Promise<Document[]> {
        // Implementation needed based on specific requirements
        return [] as any;
    }

    /**
     * Get SQL table
     *
     * @param string $name
     * @return string
     * @throws DatabaseException
     */
    protected getSQLTable(sname: string): string {
        return `{$this->getDatabase()}` + `{$this->getNamespace()}_{$this->filter($name)}`;
    }

    /**
     * Get Document by ID
     *
     * @param collection string
     * @param id string
     * @param queries Query[]
     * @param forUpdate boolean
     * @returns Promise<Document>
     * @throws DatabaseException
     */
    async getDocument(collection: string, id: string, queries: Query[] = [], forUpdate: boolean = false): Promise<Document> {
        const name = this.filter(collection);
        const selections = this.getAttributeSelections(queries);

        const forUpdateClause = forUpdate ? 'FOR UPDATE' : '';

        let sql = `
            SELECT ${this.getAttributeProjection(selections)}
            FROM ${this.getSQLTable(name)}
            WHERE _uid = :_uid
        `;

        if (this.sharedTables) {
            sql += " AND _tenant = :_tenant";
        }

        if (this.getSupportForUpdateLock()) {
            sql += ` ${forUpdateClause}`;
        }

        try {
            const params: any = { _uid: id };
            if (this.sharedTables) {
                params._tenant = this.getTenant();
            }

            const [rows] = await this.pdo.execute<RowDataPacket[]>(sql, params);

            if (rows.length === 0) {
                return new Document({});
            }

            let document = rows[0];

            if (document._id !== undefined) {
                document.$internalId = document._id;
                delete document._id;
            }
            if (document._uid !== undefined) {
                document.$id = document._uid;
                delete document._uid;
            }
            if (document._tenant !== undefined) {
                document.$tenant = document._tenant;
                delete document._tenant;
            }
            if (document._createdAt !== undefined) {
                document.$createdAt = document._createdAt;
                delete document._createdAt;
            }
            if (document._updatedAt !== undefined) {
                document.$updatedAt = document._updatedAt;
                delete document._updatedAt;
            }
            if (document._permissions !== undefined) {
                document.$permissions = JSON.parse(document._permissions || '[]');
                delete document._permissions;
            }

            return new Document(document);
        } catch (e: any) {
            throw new DatabaseException(`Failed to get document: ${e.message}`, e.code, e);
        }
    }

     /**
     * Get SQL condition for permissions
     *
     * @param string $collection
     * @param array<string> $roles
     * @return string
     * @throws Exception
     */
     protected getSQLPermissionsCondition(collection: string, roles: string[]): string {
        const quotedRoles = roles.map(role => this.pdo.escape(role));

        let tenantQuery = '';
        if (this.sharedTables) {
            tenantQuery = 'AND _tenant = :_tenant';
        }

        return `table_main._uid IN (
                    SELECT _document
                    FROM ${this.getSQLTable(collection + '_perms')}
                    WHERE _permission IN (${quotedRoles.join(', ')})
                      AND _type = 'read'
                      ${tenantQuery}
                )`;
    }

    /**
     * Get Maximum String Length
     *
     * @returns number
     */
    async getLimitForString(): Promise<number> {
        return 4294967295;
    }

    /**
     * Get Maximum Integer Length
     *
     * @returns number
     */
    async getLimitForInt(): Promise<number> {
        return 4294967295;
    }

    /**
     * Get Maximum Attributes Limit
     *
     * @returns number
     */
    async getLimitForAttributes(): Promise<number> {
        return 1017;
    }

    /**
     * Get Maximum Indexes Limit
     *
     * @returns number
     */
    async getLimitForIndexes(): Promise<number> {
        return 64;
    }

    /**
     * Check if Schemas are Supported
     *
     * @returns boolean
     */
    async getSupportForSchemas(): Promise<boolean> {
        return true;
    }

    /**
     * Check if Indexes are Supported
     *
     * @returns boolean
     */
    async getSupportForIndex(): Promise<boolean> {
        return true;
    }

    /**
     * Check if Attributes are Supported
     *
     * @returns boolean
     */
    async getSupportForAttributes(): Promise<boolean> {
        return true;
    }

    /**
     * Check if Unique Indexes are Supported
     *
     * @returns boolean
     */
    async getSupportForUniqueIndex(): Promise<boolean> {
        return true;
    }

    /**
     * Check if Fulltext Indexes are Supported
     *
     * @returns boolean
     */
    async getSupportForFulltextIndex(): Promise<boolean> {
        return true;
    }

    /**
     * Check if Update Locks are Supported
     *
     * @returns boolean
     */
    async getSupportForUpdateLock(): Promise<boolean> {
        return true;
    }

    /**
     * Check if Attribute Resizing is Supported
     *
     * @returns boolean
     */
    async getSupportForAttributeResizing(): Promise<boolean> {
        return true;
    }

    /**
     * Get Count of Attributes in Collection
     *
     * @param collection Document
     * @returns number
     */
    async getCountOfAttributes(collection: Document): Promise<number> {
        const attributes = (collection.getAttribute('attributes') as any[]).length || 0;
        return attributes + SQL.getCountOfDefaultAttributes() + 1; // +1 buffer
    }

    /**
     * Get Count of Indexes in Collection
     *
     * @param collection Document
     * @returns number
     */
    async getCountOfIndexes(collection: Document): Promise<number> {
        const indexes = (collection.getAttribute('indexes') as any[]).length || 0;
        return indexes + SQL.getCountOfDefaultIndexes();
    }

    /**
     * Get Default Count of Attributes
     *
     * @returns number
     */
    static getCountOfDefaultAttributes(): number {
        return Database.INTERNAL_ATTRIBUTES.length;
    }

    /**
     * Get Default Count of Indexes
     *
     * @returns number
     */
    static getCountOfDefaultIndexes(): number {
        return Database.INTERNAL_INDEXES.length;
    }

    /**
     * Get Document Size Limit
     *
     * @returns number
     */
    static getDocumentSizeLimit(): number {
        return 65535;
    }

    /**
     * Estimate Attribute Width
     *
     * @param collection Document
     * @returns number
     * @throws DatabaseException
     */
    getAttributeWidth(collection: Document): number {
        let total = 1500; // Base bytes

        const attributes = collection.getAttribute('attributes') as any[];

        for (const attribute of attributes) {
            switch (attribute.type) {
                case Database.VAR_STRING:
                    total += (() => {
                        if (attribute.size > 16777215) return 12;
                        if (attribute.size > 65535) return 11;
                        if (attribute.size > this.getMaxVarcharLength()) return 10;
                        if (attribute.size > 255) return (attribute.size * 4) + 2;
                        return (attribute.size * 4) + 1;
                    })();
                    break;
                case Database.VAR_INTEGER:
                    total += attribute.size >= 8 ? 8 : 4;
                    break;
                case Database.VAR_FLOAT:
                    total += 8;
                    break;
                case Database.VAR_BOOLEAN:
                    total += 1;
                    break;
                case Database.VAR_RELATIONSHIP:
                    total += 4;
                    break;
                case Database.VAR_DATETIME:
                    total += 19;
                    break;
                default:
                    throw new DatabaseException(`Unknown type: ${attribute.type}`);
            }
        }

        return total;
    }

    /**
  * @return int
  */
    public getMaxVarcharLength(): number {
        return 16381; // Floor value for Postgres:16383 | MySQL:16381 | MariaDB:16382
    }

    /**
     * @return int
     */
    public getMaxIndexLength(): number {
        return 768;
    }

    /**
     * Get List of Reserved Keywords
     *
     * @returns string[]
     */
    getKeywords(): string[] {
        return [
            'ACCESSIBLE', 'ADD', 'ALL', 'ALTER', 'ANALYZE', 'AND', 'AS', 'ASC', 'ASENSITIVE',
            'BEFORE', 'BETWEEN', 'BIGINT', 'BINARY', 'BLOB', 'BOTH', 'BY', 'CALL', 'CASCADE',
            'CASE', 'CHANGE', 'CHAR', 'CHARACTER', 'CHECK', 'COLLATE', 'COLUMN', 'CONDITION',
            'CONSTRAINT', 'CONTINUE', 'CONVERT', 'CREATE', 'CROSS', 'CURRENT_DATE',
            'CURRENT_ROLE', 'CURRENT_TIME', 'CURRENT_TIMESTAMP', 'CURRENT_USER', 'CURSOR',
            'DATABASE', 'DATABASES', 'DAY_HOUR', 'DAY_MICROSECOND', 'DAY_MINUTE', 'DAY_SECOND',
            'DEC', 'DECIMAL', 'DECLARE', 'DEFAULT', 'DELAYED', 'DELETE', 'DELETE_DOMAIN_ID',
            'DESC', 'DESCRIBE', 'DETERMINISTIC', 'DISTINCT', 'DISTINCTROW', 'DIV',
            'DO_DOMAIN_IDS', 'DOUBLE', 'DROP', 'DUAL', 'EACH', 'ELSE', 'ELSEIF', 'ENCLOSED',
            'ESCAPED', 'EXCEPT', 'EXISTS', 'EXIT', 'EXPLAIN', 'FALSE', 'FETCH', 'FLOAT',
            'FLOAT4', 'FLOAT8', 'FOR', 'FORCE', 'FOREIGN', 'FROM', 'FULLTEXT', 'GENERAL',
            'GRANT', 'GROUP', 'HAVING', 'HIGH_PRIORITY', 'HOUR_MICROSECOND', 'HOUR_MINUTE',
            'HOUR_SECOND', 'IF', 'IGNORE', 'IGNORE_DOMAIN_IDS', 'IGNORE_SERVER_IDS', 'IN',
            'INDEX', 'INFILE', 'INNER', 'INOUT', 'INSENSITIVE', 'INSERT', 'INT', 'INT1',
            'INT2', 'INT3', 'INT4', 'INT8', 'INTEGER', 'INTERSECT', 'INTERVAL', 'INTO',
            'IS', 'ITERATE', 'JOIN', 'KEY', 'KEYS', 'KILL', 'LEADING', 'LEAVE', 'LEFT',
            'LIKE', 'LIMIT', 'LINEAR', 'LINES', 'LOAD', 'LOCALTIME', 'LOCALTIMESTAMP', 'LOCK',
            'LONG', 'LONGBLOB', 'LONGTEXT', 'LOOP', 'LOW_PRIORITY', 'MASTER_HEARTBEAT_PERIOD',
            'MASTER_SSL_VERIFY_SERVER_CERT', 'MATCH', 'MAXVALUE', 'MEDIUMBLOB', 'MEDIUMINT',
            'MEDIUMTEXT', 'MIDDLEINT', 'MINUTE_MICROSECOND', 'MINUTE_SECOND', 'MOD',
            'MODIFIES', 'NATURAL', 'NOT', 'NO_WRITE_TO_BINLOG', 'NULL', 'NUMERIC', 'OFFSET',
            'ON', 'OPTIMIZE', 'OPTION', 'OPTIONALLY', 'OR', 'ORDER', 'OUT', 'OUTER',
            'OUTFILE', 'OVER', 'PAGE_CHECKSUM', 'PARSE_VCOL_EXPR', 'PARTITION', 'POSITION',
            'PRECISION', 'PRIMARY', 'PROCEDURE', 'PURGE', 'RANGE', 'READ', 'READS',
            'READ_WRITE', 'REAL', 'RECURSIVE', 'REF_SYSTEM_ID', 'REFERENCES', 'REGEXP',
            'RELEASE', 'RENAME', 'REPEAT', 'REPLACE', 'REQUIRE', 'RESIGNAL', 'RESTRICT',
            'RETURN', 'RETURNING', 'REVOKE', 'RIGHT', 'RLIKE', 'ROWS', 'SCHEMA', 'SCHEMAS',
            'SECOND_MICROSECOND', 'SELECT', 'SENSITIVE', 'SEPARATOR', 'SET', 'SHOW', 'SIGNAL',
            'SLOW', 'SMALLINT', 'SPATIAL', 'SPECIFIC', 'SQL', 'SQLEXCEPTION', 'SQLSTATE',
            'SQLWARNING', 'SQL_BIG_RESULT', 'SQL_CALC_FOUND_ROWS', 'SQL_SMALL_RESULT', 'SSL',
            'STARTING', 'STATS_AUTO_RECALC', 'STATS_PERSISTENT', 'STATS_SAMPLE_PAGES',
            'STRAIGHT_JOIN', 'TABLE', 'TERMINATED', 'THEN', 'TINYBLOB', 'TINYINT', 'TINYTEXT',
            'TO', 'TRAILING', 'TRIGGER', 'TRUE', 'UNDO', 'UNION', 'UNIQUE', 'UNLOCK',
            'UNSIGNED', 'UPDATE', 'USAGE', 'USE', 'USING', 'UTC_DATE', 'UTC_TIME',
            'UTC_TIMESTAMP', 'VALUES', 'VARBINARY', 'VARCHAR', 'VARCHARACTER', 'VARYING',
            'WHEN', 'WHERE', 'WHILE', 'WINDOW', 'WITH', 'WRITE', 'XOR', 'YEAR_MONTH',
            'ZEROFILL', 'ACTION', 'BIT', 'DATE', 'ENUM', 'NO', 'TEXT', 'TIME', 'TIMESTAMP',
            'BODY', 'ELSIF', 'GOTO', 'HISTORY', 'MINUS', 'OTHERS', 'PACKAGE', 'PERIOD',
            'RAISE', 'ROWNUM', 'ROWTYPE', 'SYSDATE', 'SYSTEM', 'SYSTEM_TIME', 'VERSIONING',
            'WITHOUT'
        ];
    }
}
