export const APP_NAME = 'Appwrite';
export const APP_DOMAIN = 'appwrite.io';
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
export const APP_SOCIAL_TWITTER = 'https://twitter.com/appwrite';
export const APP_SOCIAL_TWITTER_HANDLE = 'appwrite';
export const APP_SOCIAL_FACEBOOK = 'https://www.facebook.com/appwrite.io';
export const APP_SOCIAL_LINKEDIN = 'https://www.linkedin.com/company/appwrite';
export const APP_SOCIAL_INSTAGRAM = 'https://www.instagram.com/appwrite.io';
export const APP_SOCIAL_GITHUB = 'https://github.com/appwrite';
export const APP_SOCIAL_DISCORD = 'https://appwrite.io/discord';
export const APP_SOCIAL_DISCORD_CHANNEL = '564160730845151244';
export const APP_SOCIAL_DEV = 'https://dev.to/appwrite';
export const APP_SOCIAL_STACKSHARE = 'https://stackshare.io/appwrite';
export const APP_SOCIAL_YOUTUBE = 'https://www.youtube.com/c/appwrite?sub_confirmation=1';
export const APP_HOSTNAME_INTERNAL = 'appwrite';

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