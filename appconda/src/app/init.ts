import { App } from "@tuval/http";
import { PublicDomain } from "@tuval/domains";
import { Registry } from "@tuval/registry";
import { Config } from "@tuval/config";
import { Database, Query, Structure, Datetime as DatetimeValidator, MariaDB } from "@tuval/database";
import { Authorization, Document, IP, WhiteList, URLValidator, Range, Hostname, ID } from "@tuval/core";
import { OpenSSL } from "../Appconda/OpenSSL/OpenSSL";
import { Email } from "../Appconda/Network/Validators/Email";
import { AppcondaURL } from "../Appconda/Url/URL";
import { Group, Pool } from '@tuval/pools'
import { Redis as RedisCache } from '@tuval/cache'
import { DSN } from "@tuval/dsn";
import { createClient, RedisClientType } from 'redis';
import { Connection, RedisConnection } from "@tuval/queue";
import nodemailer from 'nodemailer';
import _default, * as maxmind from 'maxmind'
import path, { join } from "path";
import { existsSync, readFileSync } from "fs";
import { Hooks } from "../Appconda/Hooks/Hooks";
import http from 'http';
import { Locale } from "@tuval/locale";
import url from 'url';
import { Messaging } from "../Appconda/Event/Messaging";
import { Mail } from "../Appconda/Event/Mail";
import { Build } from "../Appconda/Event/Build";
import { Delete } from "../Appconda/Event/Delete";
import { Event } from "../Appconda/Event/Event";
import { Audit } from "../Appconda/Event/Audit";
import { Func } from "../Appconda/Event/Func";
import { Usage } from "../Appconda/Event/Usage";
import { Certificate } from "../Appconda/Event/Certificate";
import { Migration } from "../Appconda/Event/Migration";
import { Origin } from "../Appconda/Network/Validators/Origin";

let geoReader: maxmind.Reader<maxmind.CityResponse> | null = null;

const initializeGeoReader = async () => {
    if (!geoReader) {
        geoReader = await maxmind.open<maxmind.CityResponse>(path.resolve(__dirname, 'assets/dbip/dbip-country-lite-2024-02.mmdb'));
    }
};



const getGeoInfo = async (ip: string) => {
    if (!geoReader) {
        await initializeGeoReader();
    }
    if (geoReader) {
        return geoReader.get(ip);
    }
    return null;
};

export function createRedisInstance(dsnHost: string, dsnPort: number, dsnPass?: string) {
    const client = createClient({
        socket: {
            host: dsnHost,
            port: dsnPort,
            // The 'redis' package handles persistent connections internally
            // You can configure reconnection strategies if needed
        },
        password: dsnPass || undefined,
    });

    // Handle connection errors
    client.on('error', (err) => {
        console.error('Redis Client Error', err);
    });

    // Connect to Redis
    client.connect();

    // Note: The 'redis' package does not have a direct equivalent to Redis::OPT_READ_TIMEOUT
    // However, you can configure socket timeouts if necessary
    // Example:
    // client.options.socket.connectTimeout = 0; // 0 for no timeout

    return client;
}

export const APP_NAME = 'Appconda';
export const APP_DOMAIN = 'appconda.io';
export const APP_EMAIL_TEAM = 'team@localhost.test'; // Default email address
export const APP_EMAIL_SECURITY = ''; // Default security email address
export const APP_USERAGENT = `${APP_NAME}-Server v%s. Please report abuse at %s`;
export const APP_MODE_DEFAULT = 'default';
export const APP_MODE_ADMIN = 'admin';
export const APP_PAGING_LIMIT = 12;
export const APP_LIMIT_COUNT = 5000;
export const APP_LIMIT_USERS = 10_000;
export const APP_LIMIT_USER_PASSWORD_HISTORY = 20;
export const APP_LIMIT_USER_SESSIONS_MAX = 100;
export const APP_LIMIT_USER_SESSIONS_DEFAULT = 10;
export const APP_LIMIT_ANTIVIRUS = 20_000_000; // 20MB
export const APP_LIMIT_ENCRYPTION = 20_000_000; // 20MB
export const APP_LIMIT_COMPRESSION = 20_000_000; // 20MB
export const APP_LIMIT_ARRAY_PARAMS_SIZE = 100; // Default maximum of how many elements can there be in API parameter that expects array value
export const APP_LIMIT_ARRAY_LABELS_SIZE = 1000; // Default maximum of how many labels elements can there be in API parameter that expects array value
export const APP_LIMIT_ARRAY_ELEMENT_SIZE = 4096; // Default maximum length of element in array parameter represented by maximum URL length.
export const APP_LIMIT_SUBQUERY = 1000;
export const APP_LIMIT_SUBSCRIBERS_SUBQUERY = 1_000_000;
export const APP_LIMIT_WRITE_RATE_DEFAULT = 60; // Default maximum write rate per rate period
export const APP_LIMIT_WRITE_RATE_PERIOD_DEFAULT = 60; // Default maximum write rate period in seconds
export const APP_LIMIT_LIST_DEFAULT = 25; // Default maximum number of items to return in list API calls
export const APP_KEY_ACCCESS = 24 * 60 * 60; // 24 hours
export const APP_USER_ACCCESS = 24 * 60 * 60; // 24 hours
export const APP_CACHE_UPDATE = 24 * 60 * 60; // 24 hours
export const APP_CACHE_BUSTER = 4331;
export const APP_VERSION_STABLE = '1.5.11';
export const APP_DATABASE_ATTRIBUTE_EMAIL = 'email';
export const APP_DATABASE_ATTRIBUTE_ENUM = 'enum';
export const APP_DATABASE_ATTRIBUTE_IP = 'ip';
export const APP_DATABASE_ATTRIBUTE_DATETIME = 'datetime';
export const APP_DATABASE_ATTRIBUTE_URL = 'url';
export const APP_DATABASE_ATTRIBUTE_INT_RANGE = 'intRange';
export const APP_DATABASE_ATTRIBUTE_FLOAT_RANGE = 'floatRange';
export const APP_DATABASE_ATTRIBUTE_STRING_MAX_LENGTH = 1_073_741_824; // 2^32 bits / 4 bits per char
export const APP_DATABASE_TIMEOUT_MILLISECONDS = 15_000;
export const APP_STORAGE_UPLOADS = '/storage/uploads';
export const APP_STORAGE_FUNCTIONS = '/storage/functions';
export const APP_STORAGE_BUILDS = '/storage/builds';
export const APP_STORAGE_CACHE = '/storage/cache';
export const APP_STORAGE_CERTIFICATES = '/storage/certificates';
export const APP_STORAGE_CONFIG = '/storage/config';
export const APP_STORAGE_READ_BUFFER = 20 * (1000 * 1000); // 20MB
export const APP_SOCIAL_TWITTER = 'https://twitter.com/appconda';
export const APP_SOCIAL_TWITTER_HANDLE = 'appconda';
export const APP_SOCIAL_FACEBOOK = 'https://www.facebook.com/appconda.io';
export const APP_SOCIAL_LINKEDIN = 'https://www.linkedin.com/company/appconda';
export const APP_SOCIAL_INSTAGRAM = 'https://www.instagram.com/appconda.io';
export const APP_SOCIAL_GITHUB = 'https://github.com/appconda';
export const APP_SOCIAL_DISCORD = 'https://appconda.io/discord';
export const APP_SOCIAL_DISCORD_CHANNEL = '564160730845151244';
export const APP_SOCIAL_DEV = 'https://dev.to/appconda';
export const APP_SOCIAL_STACKSHARE = 'https://stackshare.io/appconda';
export const APP_SOCIAL_YOUTUBE = 'https://www.youtube.com/c/appconda?sub_confirmation=1';
export const APP_HOSTNAME_INTERNAL = 'appconda';

// Database Reconnect
export const DATABASE_RECONNECT_SLEEP = 2;
export const DATABASE_RECONNECT_MAX_ATTEMPTS = 10;

// Database Worker Types
export const DATABASE_TYPE_CREATE_ATTRIBUTE = 'createAttribute';
export const DATABASE_TYPE_CREATE_INDEX = 'createIndex';
export const DATABASE_TYPE_DELETE_ATTRIBUTE = 'deleteAttribute';
export const DATABASE_TYPE_DELETE_INDEX = 'deleteIndex';
export const DATABASE_TYPE_DELETE_COLLECTION = 'deleteCollection';
export const DATABASE_TYPE_DELETE_DATABASE = 'deleteDatabase';

// Build Worker Types
export const BUILD_TYPE_DEPLOYMENT = 'deployment';
export const BUILD_TYPE_RETRY = 'retry';

// Deletion Types
export const DELETE_TYPE_DATABASES = 'databases';
export const DELETE_TYPE_DOCUMENT = 'document';
export const DELETE_TYPE_COLLECTIONS = 'collections';
export const DELETE_TYPE_PROJECTS = 'projects';
export const DELETE_TYPE_FUNCTIONS = 'functions';
export const DELETE_TYPE_DEPLOYMENTS = 'deployments';
export const DELETE_TYPE_USERS = 'users';
export const DELETE_TYPE_TEAMS = 'teams';
export const DELETE_TYPE_EXECUTIONS = 'executions';
export const DELETE_TYPE_AUDIT = 'audit';
export const DELETE_TYPE_ABUSE = 'abuse';
export const DELETE_TYPE_USAGE = 'usage';
export const DELETE_TYPE_REALTIME = 'realtime';
export const DELETE_TYPE_BUCKETS = 'buckets';
export const DELETE_TYPE_INSTALLATIONS = 'installations';
export const DELETE_TYPE_RULES = 'rules';
export const DELETE_TYPE_SESSIONS = 'sessions';
export const DELETE_TYPE_CACHE_BY_TIMESTAMP = 'cacheByTimeStamp';
export const DELETE_TYPE_CACHE_BY_RESOURCE = 'cacheByResource';
export const DELETE_TYPE_SCHEDULES = 'schedules';
export const DELETE_TYPE_TOPIC = 'topic';
export const DELETE_TYPE_TARGET = 'target';
export const DELETE_TYPE_EXPIRED_TARGETS = 'invalid_targets';
export const DELETE_TYPE_SESSION_TARGETS = 'session_targets';

// Message types
export const MESSAGE_SEND_TYPE_INTERNAL = 'internal';
export const MESSAGE_SEND_TYPE_EXTERNAL = 'external';
// Mail Types
export const MAIL_TYPE_VERIFICATION = 'verification';
export const MAIL_TYPE_MAGIC_SESSION = 'magicSession';
export const MAIL_TYPE_RECOVERY = 'recovery';
export const MAIL_TYPE_INVITATION = 'invitation';
export const MAIL_TYPE_CERTIFICATE = 'certificate';
// Auth Types
export const APP_AUTH_TYPE_SESSION = 'Session';
export const APP_AUTH_TYPE_JWT = 'JWT';
export const APP_AUTH_TYPE_KEY = 'Key';
export const APP_AUTH_TYPE_ADMIN = 'Admin';
// Response related
export const MAX_OUTPUT_CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
// Function headers
export const FUNCTION_ALLOWLIST_HEADERS_REQUEST = ['content-type', 'agent', 'content-length', 'host'];
export const FUNCTION_ALLOWLIST_HEADERS_RESPONSE = ['content-type', 'content-length'];
// Message types
export const MESSAGE_TYPE_EMAIL = 'email';
export const MESSAGE_TYPE_SMS = 'sms';
export const MESSAGE_TYPE_PUSH = 'push';
// Usage metrics
export const METRIC_TEAMS = 'teams';
export const METRIC_USERS = 'users';
export const METRIC_MESSAGES = 'messages';
export const METRIC_MESSAGES_COUNTRY_CODE = '{countryCode}.messages';
export const METRIC_SESSIONS = 'sessions';
export const METRIC_DATABASES = 'databases';
export const METRIC_COLLECTIONS = 'collections';
export const METRIC_DATABASE_ID_COLLECTIONS = '{databaseInternalId}.collections';
export const METRIC_DOCUMENTS = 'documents';
export const METRIC_DATABASE_ID_DOCUMENTS = '{databaseInternalId}.documents';
export const METRIC_DATABASE_ID_COLLECTION_ID_DOCUMENTS = '{databaseInternalId}.{collectionInternalId}.documents';
export const METRIC_BUCKETS = 'buckets';
export const METRIC_FILES = 'files';
export const METRIC_FILES_STORAGE = 'files.storage';
export const METRIC_BUCKET_ID_FILES = '{bucketInternalId}.files';
export const METRIC_BUCKET_ID_FILES_STORAGE = '{bucketInternalId}.files.storage';
export const METRIC_FUNCTIONS = 'functions';
export const METRIC_DEPLOYMENTS = 'deployments';
export const METRIC_DEPLOYMENTS_STORAGE = 'deployments.storage';
export const METRIC_BUILDS = 'builds';
export const METRIC_BUILDS_STORAGE = 'builds.storage';
export const METRIC_BUILDS_COMPUTE = 'builds.compute';
export const METRIC_BUILDS_MB_SECONDS = 'builds.mbSeconds';
export const METRIC_FUNCTION_ID_BUILDS = '{functionInternalId}.builds';
export const METRIC_FUNCTION_ID_BUILDS_STORAGE = '{functionInternalId}.builds.storage';
export const METRIC_FUNCTION_ID_BUILDS_COMPUTE = '{functionInternalId}.builds.compute';
export const METRIC_FUNCTION_ID_DEPLOYMENTS = '{resourceType}.{resourceInternalId}.deployments';
export const METRIC_FUNCTION_ID_DEPLOYMENTS_STORAGE = '{resourceType}.{resourceInternalId}.deployments.storage';
export const METRIC_FUNCTION_ID_BUILDS_MB_SECONDS = '{functionInternalId}.builds.mbSeconds';
export const METRIC_EXECUTIONS = 'executions';
export const METRIC_EXECUTIONS_COMPUTE = 'executions.compute';
export const METRIC_EXECUTIONS_MB_SECONDS = 'executions.mbSeconds';
export const METRIC_FUNCTION_ID_EXECUTIONS = '{functionInternalId}.executions';
export const METRIC_FUNCTION_ID_EXECUTIONS_COMPUTE = '{functionInternalId}.executions.compute';
export const METRIC_FUNCTION_ID_EXECUTIONS_MB_SECONDS = '{functionInternalId}.executions.mbSeconds';
export const METRIC_NETWORK_REQUESTS = 'network.requests';
export const METRIC_NETWORK_INBOUND = 'network.inbound';
export const METRIC_NETWORK_OUTBOUND = 'network.outbound';


const register = new Registry();

App.setMode(process.env._APP_ENV || App.MODE_TYPE_PRODUCTION);

if (!App.isProduction()) {
    // Allow specific domains to skip public domain validation in dev environment
    // Useful for existing tests involving webhooks
    PublicDomain.allow(['request-catcher']);
}


/*
 * ENV vars
 */
Config.load('events', __dirname + '/config/events');
Config.load('auth', __dirname + '/config/auth');
Config.load('apis', __dirname + '/config/apis');  // List of APIs
Config.load('errors', __dirname + '/config/errors');
Config.load('oAuthProviders', __dirname + '/config/oAuthProviders');
Config.load('platforms', __dirname + '/config/platforms');
Config.load('collections', __dirname + '/config/collections');
Config.load('runtimes', __dirname + '/config/runtimes');
Config.load('runtimes-v2', __dirname + '/config/runtimes-v2');
Config.load('usage', __dirname + '/config/usage');
Config.load('roles', __dirname + '/config/roles');  // User roles and scopes
Config.load('scopes', __dirname + '/config/scopes');  // User roles and scopes
Config.load('services', __dirname + '/config/services');  // List of services
Config.load('variables', __dirname + '/config/variables');  // List of env variables
Config.load('regions', __dirname + '/config/regions'); // List of available regions
Config.load('avatar-browsers', __dirname + '/config/avatars/browsers');
Config.load('avatar-credit-cards', __dirname + '/config/avatars/credit-cards');
Config.load('avatar-flags', __dirname + '/config/avatars/flags');
Config.load('locale-codes', __dirname + '/config/locale/codes');
Config.load('locale-currencies', __dirname + '/config/locale/currencies');
Config.load('locale-eu', __dirname + '/config/locale/eu');
Config.load('locale-languages', __dirname + '/config/locale/languages');
Config.load('locale-phones', __dirname + '/config/locale/phones');
Config.load('locale-countries', __dirname + '/config/locale/countries');
Config.load('locale-continents', __dirname + '/config/locale/continents');
Config.load('locale-templates', __dirname + '/config/locale/templates');
Config.load('storage-logos', __dirname + '/config/storage/logos');
Config.load('storage-mimes', __dirname + '/config/storage/mimes');
Config.load('storage-inputs', __dirname + '/config/storage/inputs');
Config.load('storage-outputs', __dirname + '/config/storage/outputs');


/**
 * New DB Filters
 */
Database.addFilter(
    'casting',
    (value: any) => {
        return JSON.stringify({ value: value }, (key, value) =>
            typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(2) : value
        );
    },
    (value: any) => {
        if (value === null) {
            return;
        }
        return JSON.parse(value).value;
    }
);

Database.addFilter(
    'enum',
    (value: any, attribute: Document) => {
        if (attribute.has('elements')) {
            attribute.removeAttribute('elements');
        }
        return value;
    },
    (value: any, attribute: Document) => {
        const formatOptions = JSON.parse(attribute.getAttribute('formatOptions', '[]'));
        if (formatOptions.elements) {
            attribute.setAttribute('elements', formatOptions.elements);
        }
        return value;
    }
);

Database.addFilter(
    'range',
    (value: any, attribute: Document) => {
        if (attribute.has('min')) {
            attribute.removeAttribute('min');
        }
        if (attribute.has('max')) {
            attribute.removeAttribute('max');
        }
        return value;
    },
    (value: any, attribute: Document) => {
        const formatOptions = JSON.parse(attribute.getAttribute('formatOptions', '[]'));
        if (formatOptions.min || formatOptions.max) {
            attribute
                .setAttribute('min', formatOptions.min)
                .setAttribute('max', formatOptions.max);
        }
        return value;
    }
);

Database.addFilter(
    'subQueryAttributes',
    (value: any) => {
        return;
    },
    async (value: any, document: Document, database: Database) => {
        const attributes = await database.find('attributes', [
            Query.equal('collectionInternalId', [document.getInternalId()]),
            Query.equal('databaseInternalId', [document.getAttribute('databaseInternalId')]),
            Query.limit(database.getLimitForAttributes()),
        ]);

        for (const attribute of attributes) {
            if (attribute.getAttribute('type') === Database.VAR_RELATIONSHIP) {
                const options = attribute.getAttribute('options');
                for (const key in options) {
                    attribute.setAttribute(key, options[key]);
                }
                attribute.removeAttribute('options');
            }
        }

        return attributes;
    }
);

Database.addFilter(
    'subQueryIndexes',
    (value: any) => {
        return;
    },
    async (value: any, document: Document, database: Database) => {
        return await database.find('indexes', [
            Query.equal('collectionInternalId', [document.getInternalId()]),
            Query.equal('databaseInternalId', [document.getAttribute('databaseInternalId')]),
            Query.limit(database.getLimitForIndexes()),
        ]);
    }
);

Database.addFilter(
    'subQueryPlatforms',
    (value: any) => {
        return;
    },
    async (value: any, document: Document, database: Database) => {
        return await database.find('platforms', [
            Query.equal('projectInternalId', [document.getInternalId()]),
            Query.limit(APP_LIMIT_SUBQUERY),
        ]);
    }
);

Database.addFilter(
    'subQueryKeys',
    (value: any) => {
        return;
    },
    async (value: any, document: Document, database: Database) => {
        return await database.find('keys', [
            Query.equal('projectInternalId', [document.getInternalId()]),
            Query.limit(APP_LIMIT_SUBQUERY),
        ]);
    }
);

Database.addFilter(
    'subQueryWebhooks',
    (value: any) => {
        return;
    },
    async (value: any, document: Document, database: Database) => {
        return await database.find('webhooks', [
            Query.equal('projectInternalId', [document.getInternalId()]),
            Query.limit(APP_LIMIT_SUBQUERY),
        ]);
    }
);

Database.addFilter(
    'subQuerySessions',
    (value: any) => {
        return;
    },
    async (value: any, document: Document, database: Database) => {
        return await Authorization.skip(() => database.find('sessions', [
            Query.equal('userInternalId', [document.getInternalId()]),
            Query.limit(APP_LIMIT_SUBQUERY),
        ]));
    }
);

Database.addFilter(
    'subQueryTokens',
    (value: any) => {
        return;
    },
    async (value: any, document: Document, database: Database) => {
        return await Authorization.skip(() => database.find('tokens', [
            Query.equal('userInternalId', [document.getInternalId()]),
            Query.limit(APP_LIMIT_SUBQUERY),
        ]));
    }
);

Database.addFilter(
    'subQueryChallenges',
    (value: any) => {
        return;
    },
    async (value: any, document: Document, database: Database) => {
        return await Authorization.skip(async () => await database.find('challenges', [
            Query.equal('userInternalId', [document.getInternalId()]),
            Query.limit(APP_LIMIT_SUBQUERY),
        ]));
    }
);

Database.addFilter(
    'subQueryAuthenticators',
    (value: any) => {
        return;
    },
    async (value: any, document: Document, database: Database) => {
        return await Authorization.skip(() => database.find('authenticators', [
            Query.equal('userInternalId', [document.getInternalId()]),
            Query.limit(APP_LIMIT_SUBQUERY),
        ]));
    }
);

Database.addFilter(
    'subQueryMemberships',
    (value: any) => {
        return;
    },
    async (value: any, document: Document, database: Database) => {
        return await Authorization.skip(() => database.find('memberships', [
            Query.equal('userInternalId', [document.getInternalId()]),
            Query.limit(APP_LIMIT_SUBQUERY),
        ]));
    }
);


/**
 * New DB Filters
 */
Database.addFilter(
    'subQueryVariables',
    (value: any) => {
        return;
    },
    async (value: any, document: Document, database: Database) => {
        return await database.find('variables', [
            Query.equal('resourceInternalId', [document.getInternalId()]),
            Query.equal('resourceType', ['function']),
            Query.limit(APP_LIMIT_SUBQUERY),
        ]);
    }
);

Database.addFilter(
    'encrypt',
    (value: any) => {
        const key: string = process.env._APP_OPENSSL_KEY_V1 as any;
        const iv = OpenSSL.randomPseudoBytes(OpenSSL.cipherIVLength(OpenSSL.CIPHER_AES_128_GCM));
        let tag: string;

        const buffer = Buffer.from(key, 'utf-8');

        return JSON.stringify({
            data: OpenSSL.encrypt(value, OpenSSL.CIPHER_AES_128_GCM, buffer, 0, iv, tag),
            method: OpenSSL.CIPHER_AES_128_GCM,
            iv: iv.toString('hex'),
            tag: tag ? tag.toString('hex') : '',
            version: '1',
        });
    },
    (value: any) => {
        if (value === null) {
            return;
        }
        value = JSON.parse(value);
        const key = process.env['_APP_OPENSSL_KEY_V' + value.version];

        return OpenSSL.decrypt(value.data, value.method, key, 0, Buffer.from(value.iv, 'hex'), Buffer.from(value.tag, 'hex'));
    }
);

Database.addFilter(
    'subQueryProjectVariables',
    (value: any) => {
        return;
    },
    async (value: any, document: Document, database: Database) => {
        return await database.find('variables', [
            Query.equal('resourceType', ['project']),
            Query.limit(APP_LIMIT_SUBQUERY)
        ]);
    }
);

Database.addFilter(
    'userSearch',
    (value: any, user: Document) => {
        const searchValues = [
            user.getId(),
            user.getAttribute('email', ''),
            user.getAttribute('name', ''),
            user.getAttribute('phone', '')
        ];

        for (const label of user.getAttribute('labels', [])) {
            searchValues.push('label:' + label);
        }

        return searchValues.filter(Boolean).join(' ');
    },
    (value: any) => {
        return value;
    }
);

Database.addFilter(
    'subQueryTargets',
    (value: any) => {
        return;
    },
    async (value: any, document: Document, database: Database) => {
        return await Authorization.skip(() => database.find('targets', [
            Query.equal('userInternalId', [document.getInternalId()]),
            Query.limit(APP_LIMIT_SUBQUERY)
        ]));
    }
);

Database.addFilter(
    'subQueryTopicTargets',
    (value: any) => {
        return;
    },
    async (value: any, document: Document, database: Database) => {
        const targetIds = await Authorization.skip(async () => (await database.find('subscribers', [
            Query.equal('topicInternalId', [document.getInternalId()]),
            Query.limit(APP_LIMIT_SUBSCRIBERS_SUBQUERY)
        ])).map((doc: Document) => doc.getAttribute('targetInternalId')));

        if (targetIds.length > 0) {
            return await database.skipValidation(() => database.find('targets', [
                Query.equal('$internalId', targetIds)
            ]));
        }
        return [];
    }
);

Database.addFilter(
    'providerSearch',
    (value: any, provider: Document) => {
        const searchValues = [
            provider.getId(),
            provider.getAttribute('name', ''),
            provider.getAttribute('provider', ''),
            provider.getAttribute('type', '')
        ];

        return searchValues.filter(Boolean).join(' ');
    },
    (value: any) => {
        return value;
    }
);

Database.addFilter(
    'topicSearch',
    (value: any, topic: Document) => {
        const searchValues = [
            topic.getId(),
            topic.getAttribute('name', ''),
            topic.getAttribute('description', ''),
        ];

        return searchValues.filter(Boolean).join(' ');
    },
    (value: any) => {
        return value;
    }
);

Database.addFilter(
    'messageSearch',
    (value: any, message: Document) => {
        const searchValues = [
            message.getId(),
            message.getAttribute('description', ''),
            message.getAttribute('status', ''),
        ];

        const data = JSON.parse(message.getAttribute('data', '{}'));
        const providerType = message.getAttribute('providerType', '');

        if (providerType === 'email') {
            searchValues.push(data.subject, 'email');
        } else if (providerType === 'sms') {
            searchValues.push(data.content, 'sms');
        } else {
            searchValues.push(data.title, 'push');
        }

        return searchValues.filter(Boolean).join(' ');
    },
    (value: any) => {
        return value;
    }
);


/**
 * DB Formats
 */
Structure.addFormat(APP_DATABASE_ATTRIBUTE_EMAIL, () => {
    return new Email();
}, Database.VAR_STRING);

Structure.addFormat(APP_DATABASE_ATTRIBUTE_DATETIME, () => {
    return new DatetimeValidator();
}, Database.VAR_DATETIME);

Structure.addFormat(APP_DATABASE_ATTRIBUTE_ENUM, (attribute: any) => {
    const elements = attribute.formatOptions.elements;
    return new WhiteList(elements, true);
}, Database.VAR_STRING);

Structure.addFormat(APP_DATABASE_ATTRIBUTE_IP, () => {
    return new IP();
}, Database.VAR_STRING);

Structure.addFormat(APP_DATABASE_ATTRIBUTE_URL, () => {
    return new URLValidator();
}, Database.VAR_STRING);

Structure.addFormat(APP_DATABASE_ATTRIBUTE_INT_RANGE, (attribute: any) => {
    const min = attribute.formatOptions.min ?? -Infinity;
    const max = attribute.formatOptions.max ?? Infinity;
    return new Range(min, max, Range.TYPE_INTEGER);
}, Database.VAR_INTEGER);

Structure.addFormat(APP_DATABASE_ATTRIBUTE_FLOAT_RANGE, (attribute: any) => {
    const min = attribute.formatOptions.min ?? -Infinity;
    const max = attribute.formatOptions.max ?? Infinity;
    return new Range(min, max, Range.TYPE_FLOAT);
}, Database.VAR_FLOAT);


register.set('logger', () => {
    // Register error logger
    const providerName = process.env._APP_LOGGING_PROVIDER || '';
    const providerConfig = process.env._APP_LOGGING_CONFIG || '';

    if (!providerName || !providerConfig) {
        return;
    }

    if (!Logger.hasProvider(providerName)) {
        throw new Error("Logging provider not supported. Logging is disabled");
    }

    // Old Sentry Format conversion. Fallback until the old syntax is completely deprecated.
    if (providerConfig.includes(';') && providerName.toLowerCase() === 'sentry') {
        const [sentryKey, projectId] = providerConfig.split(';');
        providerConfig = `https://${sentryKey}@sentry.io/${projectId}`;
    }

    const classname = `\\Utopia\\Logger\\Adapter\\${providerName.charAt(0).toUpperCase() + providerName.slice(1)}`;
    const AdapterClass = require(classname).default;
    const adapter = new AdapterClass(providerConfig);
    return new Logger(adapter);
});


register.set('pools', () => {
    const group = new Group();

    const fallbackForDB = 'db_main=' + AppcondaURL.unparse({
        scheme: 'mariadb',
        host: process.env._APP_DB_HOST || 'mariadb',
        port: process.env._APP_DB_PORT || '3306',
        user: process.env._APP_DB_USER || '',
        pass: process.env._APP_DB_PASS || '',
        path: process.env._APP_DB_SCHEMA || '',
    });
    const fallbackForRedis = 'redis_main=' + AppcondaURL.unparse({
        scheme: 'redis',
        host: process.env._APP_REDIS_HOST || 'redis',
        port: process.env._APP_REDIS_PORT || '6379',
        user: process.env._APP_REDIS_USER || '',
        pass: process.env._APP_REDIS_PASS || '',
    });

    const connections = {
        console: {
            type: 'database',
            dsns: process.env._APP_CONNECTIONS_DB_CONSOLE || fallbackForDB,
            multiple: false,
            schemes: ['mariadb', 'mysql'],
        },
        database: {
            type: 'database',
            dsns: process.env._APP_CONNECTIONS_DB_PROJECT || fallbackForDB,
            multiple: true,
            schemes: ['mariadb', 'mysql'],
        },
        queue: {
            type: 'queue',
            dsns: process.env._APP_CONNECTIONS_QUEUE || fallbackForRedis,
            multiple: false,
            schemes: ['redis'],
        },
        pubsub: {
            type: 'pubsub',
            dsns: process.env._APP_CONNECTIONS_PUBSUB || fallbackForRedis,
            multiple: false,
            schemes: ['redis'],
        },
        cache: {
            type: 'cache',
            dsns: process.env._APP_CONNECTIONS_CACHE || fallbackForRedis,
            multiple: true,
            schemes: ['redis'],
        },
    };
    const maxConnections = process.env._APP_CONNECTIONS_MAX ? parseInt(process.env._APP_CONNECTIONS_MAX, 10) : 151;
    const instanceConnections = maxConnections / (process.env._APP_POOL_CLIENTS ? parseInt(process.env._APP_POOL_CLIENTS, 10) : 14);

    const multiprocessing = process.env._APP_SERVER_MULTIPROCESS === 'enabled';

    let workerCount: number;
    if (multiprocessing) {
        workerCount = require('os').cpus().length * (process.env._APP_WORKER_PER_CORE ? parseInt(process.env._APP_WORKER_PER_CORE, 10) : 6);
    } else {
        workerCount = 1;
    }

    if (workerCount > instanceConnections) {
        throw new Error('Pool size is too small. Increase the number of allowed database connections or decrease the number of workers.');
    }

    const poolSize = Math.floor(instanceConnections / workerCount);

    for (const [key, connection] of Object.entries(connections)) {
        const type = connection.type || '';
        const multiple = connection.multiple || false;
        const schemes = connection.schemes || [];
        const config: string[] = [];
        const dsns = (connection.dsns || '').split(',');

        for (let dsn of dsns) {
            const [namePart, dsnValue] = dsn.split('=');
            const name = multiple ? `${key}_${namePart}` : key;
            dsn = dsnValue || '';
            config.push(name);

            if (!dsn) {
                continue;
            }

            const parsedDsn = new DSN(dsn);
            const dsnHost = parsedDsn.getHost();
            const dsnPort = parsedDsn.getPort();
            const dsnUser = parsedDsn.getUser();
            const dsnPass = parsedDsn.getPassword();
            const dsnScheme = parsedDsn.getScheme();
            const dsnDatabase = parsedDsn.getPath();

            if (!schemes.includes(dsnScheme)) {
                throw new Error("Invalid console database scheme");
            }

            const resource = (() => {
                switch (dsnScheme) {
                    case 'mysql':
                    case 'mariadb':
                        return () => new MariaDB({
                            host: dsnHost,
                            port: dsnPort,
                            user: dsnUser,
                            password: dsnPass,
                            database: dsnDatabase,
                        });
                    case 'redis':
                        return () => {
                            const redis = createRedisInstance(dsnHost, dsnPort as any, dsnPass as any);
                            redis.set('read_timeout', -1);
                            return redis;
                        };
                    default:
                        throw new Error('Invalid scheme');
                }
            })();

            const pool = new Pool(name, poolSize, () => {
                let adapter;
                switch (type) {
                    case 'database':
                        adapter = (() => {
                            switch (dsnScheme) {
                                case 'mariadb':
                                    return new MariaDB(resource());
                                case 'mysql':
                                //  return new MySQL(resource());
                                default:
                                    return null;
                            }
                        })();
                        if (adapter) {
                            adapter.setDatabase(dsnDatabase);
                        }
                        break;
                    case 'pubsub':
                        adapter = resource();
                        break;
                    case 'queue':
                        adapter = (() => {
                            switch (dsnScheme) {
                                case 'redis':
                                    return new RedisConnection(dsnHost, dsnPort as any);
                                default:
                                    return null;
                            }
                        })();
                        break;
                    case 'cache':
                        adapter = (() => {
                            switch (dsnScheme) {
                                case 'redis':
                                    return new RedisCache(resource() as any);
                                default:
                                    return null;
                            }
                        })();
                        break;
                    default:
                        throw new Error("Server error: Missing adapter implementation.");
                }
                return adapter;
            });

            group.add(pool);
        }

        Config.setParam('pools-' + key, config);
    }

    return group;
});


register.set('db', () => {
    // This is usually for our workers or CLI commands scope
    const dbHost = process.env._APP_DB_HOST || '';
    const dbPort = process.env._APP_DB_PORT || '';
    const dbUser = process.env._APP_DB_USER || '';
    const dbPass = process.env._APP_DB_PASS || '';
    const dbScheme = process.env._APP_DB_SCHEMA || '';

    return require('mysql2/promise').createPool({
        host: dbHost,
        port: parseInt(dbPort, 10),
        user: dbUser,
        password: dbPass,
        database: dbScheme,
        charset: 'utf8mb4',
    });

});


register.set('smtp', () => {
    const username = process.env._APP_SMTP_USERNAME;
    const password = process.env._APP_SMTP_PASSWORD;
    const host = process.env._APP_SMTP_HOST || 'smtp';
    const port = parseInt(process.env._APP_SMTP_PORT || '25', 10);
    const secure = process.env._APP_SMTP_SECURE === 'true'; // true for 465, false for other ports

    const transporter = nodemailer.createTransport({
        host: host,
        port: port,
        secure: secure, // true for 465, false for other ports
        auth: {
            user: username,
            pass: password,
        },
    });

    const fromName = decodeURIComponent(process.env._APP_SYSTEM_EMAIL_NAME || `${APP_NAME} Server`);
    const fromEmail = process.env._APP_SYSTEM_EMAIL_ADDRESS || APP_EMAIL_TEAM;

    return {
        sendMail: async (to: string, subject: string, html: string) => {
            const info = await transporter.sendMail({
                from: `"${fromName}" <${fromEmail}>`,
                to: to,
                subject: subject,
                html: html,
            });

            console.log('Message sent: %s', info.messageId);
        },
    };
});

register.set('geodb', async () => {
    await initializeGeoReader();
    return geoReader;
});

register.set('passwordsDictionary', () => {
    const content = readFileSync(join(__dirname, 'assets', 'security', '10k-common-passwords'), 'utf-8');
    const passwords = content.split('\n').reduce((acc, password) => {
        acc[password] = true;
        return acc;
    }, {} as Record<string, boolean>);
    return passwords;
});

register.set('promiseAdapter', () => {
    new Error('Olmadi.')
});

register.set('hooks', () => {
    return new Hooks();
});


// Set exceptions to false
Locale.exceptions = false;

// Get locale codes from config
const locales = Config.getParam('locale-codes', []);

locales.forEach((locale: { code: string }) => {
    const code = locale.code;
    let filePath = path.join(__dirname, 'config', 'locale', 'translations', `${code}.json`);

    if (!existsSync(filePath)) {
        filePath = path.join(__dirname, 'config', 'locale', 'translations', `${code.substring(0, 2)}.json`);
        if (!existsSync(filePath)) {
            filePath = path.join(__dirname, 'config', 'locale', 'translations', 'en.json');
        }
    }

    Locale.setLanguageFromJSON(code, filePath);
});

// Set global user agent and HTTP settings
const userAgent = `${APP_USERAGENT.replace('%s', process.env._APP_VERSION || 'UNKNOWN').replace('%s', process.env._APP_EMAIL_SECURITY || process.env._APP_SYSTEM_SECURITY_EMAIL_ADDRESS || APP_EMAIL_SECURITY)}`;

const defaultOptions = {
    method: 'GET',
    headers: {
        'User-Agent': userAgent,
    },
    timeout: 2000, // 2 seconds
};

// Override the default http request options
const originalRequest = http.request;
http.request = (options, callback) => {
    if (typeof options === 'string') {
        options = { ...defaultOptions, ...url.parse(options) };
    } else {
        options = { ...defaultOptions, ...options };
    }
    return originalRequest(options, callback);
};


App.setResource('log', () => new Log());

App.setResource('logger', () => register.get('logger'), ['register']);

App.setResource('hooks', () => register.get('hooks'), ['register']);

App.setResource('register', () => register);

App.setResource('locale', () => new Locale(process.env._APP_LOCALE || 'en'));

App.setResource('localeCodes', () => {
    return Config.getParam('locale-codes', []).map((locale: { code: string }) => locale.code);
});

App.setResource('queue', (pools: Group) => {
    return pools.get('queue').pop().getResource();
}, ['pools']);

App.setResource('queueForMessaging', (queue: Connection) => new Messaging(queue), ['queue']);
App.setResource('queueForMails', (queue: Connection) => new Mail(queue), ['queue']);
App.setResource('queueForBuilds', (queue: Connection) => new Build(queue), ['queue']);
App.setResource('queueForDatabase', (queue: Connection) => new EventDatabase(queue), ['queue']);
App.setResource('queueForDeletes', (queue: Connection) => new Delete(queue), ['queue']);
App.setResource('queueForEvents', (queue: Connection) => new Event(queue), ['queue']);
App.setResource('queueForAudits', (queue: Connection) => new Audit(queue), ['queue']);
App.setResource('queueForFunctions', (queue: Connection) => new Func(queue), ['queue']);
App.setResource('queueForUsage', (queue: Connection) => new Usage(queue), ['queue']);
App.setResource('queueForCertificates', (queue: Connection) => new Certificate(queue), ['queue']);
App.setResource('queueForMigrations', (queue: Connection) => new Migration(queue), ['queue']);

App.setResource('clients', (request: any, console: Document, project: Document) => {
    console.setAttribute('platforms', [{
        '$collection': ID.custom('platforms'),
        'name': 'Current Host',
        'type': Origin.CLIENT_TYPE_WEB,
        'hostname': request.getHostname(),
    }], Document.SET_TYPE_APPEND);

    const hostnames = (process.env._APP_CONSOLE_HOSTNAMES || '').split(',');
    const validator = new Hostname();

    hostnames.forEach((hostname: string) => {
        hostname = hostname.trim();
        if (!validator.isValid(hostname)) {
            return;
        }
        console.setAttribute('platforms', [{
            '$collection': ID.custom('platforms'),
            'type': Origin.CLIENT_TYPE_WEB,
            'name': hostname,
            'hostname': hostname,
        }], Document.SET_TYPE_APPEND);
    });

    const clientsConsole = console.getAttribute('platforms', [])
        .filter((node: any) => node.type === Origin.CLIENT_TYPE_WEB && node.hostname)
        .map((node: any) => node.hostname);

    const clients = clientsConsole;
    const platforms = project.getAttribute('platforms', []);

    platforms.forEach((node: any) => {
        if ((node.type === Origin.CLIENT_TYPE_WEB || node.type === Origin.CLIENT_TYPE_FLUTTER_WEB) && node.hostname) {
            clients.push(node.hostname);
        }
    });

    return Array.from(new Set(clients));
}, ['request', 'console', 'project']);

