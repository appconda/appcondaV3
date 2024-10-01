
import { V16 as RequestV16 } from '../../../Appconda/Tuval/Request/Filters/V16';
import { V17 as ResponseV17 } from '../../../Appconda/Tuval/Response/Filters/V17';

Config.setParam('domainVerification', false);
Config.setParam('cookieDomain', 'localhost');
Config.setParam('cookieSamesite', Response.COOKIE_SAMESITE_NONE);

async function router(
    utopia: App,
    dbForConsole: Database,
    getProjectDB: (project: Document) => Database,
    swooleRequest: SwooleRequest,
    request: Request,
    response: Response,
    queueForEvents: Event,
    queueForUsage: Usage,
    geodb: Reader
) {
    utopia.getRoute()?.label('error', __dirname + '/../views/general/error.phtml');

    const host = request.getHostname() || '';

    const route = (await Authorization.skip(() =>
        dbForConsole.find('rules', [
            Query.equal('domain', [host]),
            Query.limit(1)
        ])
    ))[0] || null;

    if (route === null) {
        if (host === System.getEnv('_APP_DOMAIN_FUNCTIONS', '')) {
            throw new AppwriteException(AppwriteException.GENERAL_ACCESS_FORBIDDEN, 'This domain cannot be used for security reasons. Please use any subdomain instead.');
        }

        if (host.endsWith(System.getEnv('_APP_DOMAIN_FUNCTIONS', ''))) {
            throw new AppwriteException(AppwriteException.GENERAL_ACCESS_FORBIDDEN, 'This domain is not connected to any Appwrite resource yet. Please configure custom domain or function domain to allow this request.');
        }

        if (System.getEnv('_APP_OPTIONS_ROUTER_PROTECTION', 'disabled') === 'enabled') {
            if (host !== 'localhost' && host !== System.getEnv('APP_HOSTNAME_INTERNAL')) {
                throw new AppwriteException(AppwriteException.GENERAL_ACCESS_FORBIDDEN, 'Router protection does not allow accessing Appwrite over this domain. Please add it as custom domain to your project or disable _APP_OPTIONS_ROUTER_PROTECTION environment variable.');
            }
        }

        utopia.getRoute()?.label('error', '');
        return false;
    }

    const projectId = route.getAttribute('projectId');
    const project = await Authorization.skip(() => dbForConsole.getDocument('projects', projectId));
    if (project.getAttribute('services', {}).proxy === false) {
        throw new AppwriteException(AppwriteException.GENERAL_SERVICE_DISABLED);
    }

    const path = swooleRequest.server['request_uri'] || '/';
    if (path.startsWith('/.well-known/acme-challenge')) {
        return false;
    }

    const type = route.getAttribute('resourceType');

    if (type === 'function') {
        if (System.getEnv('_APP_OPTIONS_FUNCTIONS_FORCE_HTTPS', 'disabled') === 'enabled') {
            if (request.getProtocol() !== 'https') {
                if (request.getMethod() !== Request.METHOD_GET) {
                    throw new AppwriteException(AppwriteException.GENERAL_PROTOCOL_UNSUPPORTED, 'Method unsupported over HTTP. Please use HTTPS instead.');
                }

                return response.redirect('https://' + request.getHostname() + request.getURI());
            }
        }

        const functionId = route.getAttribute('resourceId');
        const projectId = route.getAttribute('projectId');

        const path = swooleRequest.server['request_uri'] || '/';
        const query = swooleRequest.server['query_string'] || '';
        if (query) {
            path += '?' + query;
        }

        const body = swooleRequest.getContent() || '';
        const method = swooleRequest.server['request_method'];

        const requestHeaders = request.getHeaders();

        const project = await Authorization.skip(() => dbForConsole.getDocument('projects', projectId));

        const dbForProject = getProjectDB(project);

        const func = await Authorization.skip(() => dbForProject.getDocument('functions', functionId));

        if (func.isEmpty() || !func.getAttribute('enabled')) {
            throw new AppwriteException(AppwriteException.FUNCTION_NOT_FOUND);
        }

        const version = func.getAttribute('version', 'v2');
        const runtimes = Config.getParam(version === 'v2' ? 'runtimes-v2' : 'runtimes', []);

        const runtime = runtimes[func.getAttribute('runtime', '')] || null;

        if (!runtime) {
            throw new AppwriteException(AppwriteException.FUNCTION_RUNTIME_UNSUPPORTED, 'Runtime "' + func.getAttribute('runtime', '') + '" is not supported');
        }

        const deployment = await Authorization.skip(() => dbForProject.getDocument('deployments', func.getAttribute('deployment', '')));

        if (deployment.getAttribute('resourceId') !== func.getId()) {
            throw new AppwriteException(AppwriteException.DEPLOYMENT_NOT_FOUND, 'Deployment not found. Create a deployment before trying to execute a function');
        }

        if (deployment.isEmpty()) {
            throw new AppwriteException(AppwriteException.DEPLOYMENT_NOT_FOUND, 'Deployment not found. Create a deployment before trying to execute a function');
        }

        const build = await Authorization.skip(() => dbForProject.getDocument('builds', deployment.getAttribute('buildId', '')));
        if (build.isEmpty()) {
            throw new AppwriteException(AppwriteException.BUILD_NOT_FOUND);
        }

        if (build.getAttribute('status') !== 'ready') {
            throw new AppwriteException(AppwriteException.BUILD_NOT_READY);
        }

        const permissions = func.getAttribute('execute');

        if (!permissions.includes('any') && !permissions.includes('guests')) {
            throw new AppwriteException(AppwriteException.USER_UNAUTHORIZED, 'To execute function using domain, execute permissions must include "any" or "guests"');
        }

        const headers = { ...requestHeaders, 'x-appwrite-trigger': 'http', 'x-appwrite-user-id': '', 'x-appwrite-user-jwt': '', 'x-appwrite-country-code': '', 'x-appwrite-continent-code': '', 'x-appwrite-continent-eu': 'false' };

        const ip = headers['x-real-ip'] || '';
        if (ip) {
            const record = geodb.get(ip);

            if (record) {
                const eu = Config.getParam('locale-eu');

                headers['x-appwrite-country-code'] = record['country']['iso_code'] || '';
                headers['x-appwrite-continent-code'] = record['continent']['code'] || '';
                headers['x-appwrite-continent-eu'] = eu.includes(record['country']['iso_code']) ? 'true' : 'false';
            }
        }

        const headersFiltered = Object.entries(headers).filter(([key]) => FUNCTION_ALLOWLIST_HEADERS_REQUEST.includes(key.toLowerCase())).map(([name, value]) => ({ name, value }));

        const executionId = ID.unique();

        const execution = new Document({
            $id: executionId,
            $permissions: [],
            functionInternalId: func.getInternalId(),
            functionId: func.getId(),
            deploymentInternalId: deployment.getInternalId(),
            deploymentId: deployment.getId(),
            trigger: 'http',
            status: 'processing',
            responseStatusCode: 0,
            responseHeaders: [],
            requestPath: path,
            requestMethod: method,
            requestHeaders: headersFiltered,
            errors: '',
            logs: '',
            duration: 0.0,
            search: [functionId, executionId].join(' '),
        });

        queueForEvents.setParam('functionId', func.getId()).setParam('executionId', execution.getId()).setContext('function', func);

        const durationStart = Date.now();

        let vars: Record<string, string> = {};

        if (version === 'v2') {
            vars = {
                ...vars,
                APPWRITE_FUNCTION_TRIGGER: headers['x-appwrite-trigger'] || '',
                APPWRITE_FUNCTION_DATA: body || '',
                APPWRITE_FUNCTION_USER_ID: headers['x-appwrite-user-id'] || '',
                APPWRITE_FUNCTION_JWT: headers['x-appwrite-user-jwt'] || ''
            };
        }

        for (const varProject of func.getAttribute('varsProject', [])) {
            vars[varProject.getAttribute('key')] = varProject.getAttribute('value', '');
        }

        for (const varFunc of func.getAttribute('vars', [])) {
            vars[varFunc.getAttribute('key')] = varFunc.getAttribute('value', '');
        }

        vars = {
            ...vars,
            APPWRITE_FUNCTION_ID: functionId,
            APPWRITE_FUNCTION_NAME: func.getAttribute('name'),
            APPWRITE_FUNCTION_DEPLOYMENT: deployment.getId(),
            APPWRITE_FUNCTION_PROJECT_ID: project.getId(),
            APPWRITE_FUNCTION_RUNTIME_NAME: runtime.name || '',
            APPWRITE_FUNCTION_RUNTIME_VERSION: runtime.version || '',
        };

        const executor = new Executor(System.getEnv('_APP_EXECUTOR_HOST'));
        try {
            const command = version === 'v2' ? '' : `cp /tmp/code.tar.gz /mnt/code/code.tar.gz && nohup helpers/start.sh "${runtime.startCommand}"`;
            const executionResponse = await executor.createExecution({
                projectId: project.getId(),
                deploymentId: deployment.getId(),
                body: body.length > 0 ? body : null,
                variables: vars,
                timeout: func.getAttribute('timeout', 0),
                image: runtime.image,
                source: build.getAttribute('path', ''),
                entrypoint: deployment.getAttribute('entrypoint', ''),
                version,
                path,
                method,
                headers,
                runtimeEntrypoint: command,
                requestTimeout: 30
            });

            const headersFiltered = Object.entries(executionResponse.headers).filter(([key]) => FUNCTION_ALLOWLIST_HEADERS_RESPONSE.includes(key.toLowerCase())).map(([name, value]) => ({ name, value }));

            const status = executionResponse.statusCode >= 400 ? 'failed' : 'completed';
            execution.setAttribute('status', status);
            execution.setAttribute('responseStatusCode', executionResponse.statusCode);
            execution.setAttribute('responseHeaders', headersFiltered);
            execution.setAttribute('logs', executionResponse.logs);
            execution.setAttribute('errors', executionResponse.errors);
            execution.setAttribute('duration', executionResponse.duration);

        } catch (th) {
            const durationEnd = Date.now();

            execution.setAttribute('duration', (durationEnd - durationStart) / 1000);
            execution.setAttribute('status', 'failed');
            execution.setAttribute('responseStatusCode', 500);
            execution.setAttribute('errors', `${th.message}\nError Code: ${th.code}`);
            console.error(th.message);

            if (th instanceof AppwriteException) {
                throw th;
            }
        } finally {
            queueForUsage
                .addMetric(METRIC_EXECUTIONS, 1)
                .addMetric(METRIC_FUNCTION_ID_EXECUTIONS.replace('{functionInternalId}', func.getInternalId()), 1)
                .addMetric(METRIC_EXECUTIONS_COMPUTE, Math.round(execution.getAttribute('duration') * 1000))
                .addMetric(METRIC_FUNCTION_ID_EXECUTIONS_COMPUTE.replace('{functionInternalId}', func.getInternalId()), Math.round(execution.getAttribute('duration') * 1000))
                .addMetric(METRIC_EXECUTIONS_MB_SECONDS, Math.round(512 * execution.getAttribute('duration', 0)))
                .addMetric(METRIC_FUNCTION_ID_EXECUTIONS_MB_SECONDS.replace('{functionInternalId}', func.getInternalId()), Math.round(512 * execution.getAttribute('duration', 0)))
                .setProject(project)
                .trigger();

            if (func.getAttribute('logging')) {
                await Authorization.skip(() => dbForProject.createDocument('executions', execution));
            }
        }

        execution.setAttribute('logs', '');
        execution.setAttribute('errors', '');

        const headers = (executionResponse.headers || []).map(([name, value]) => ({ name, value }));

        execution.setAttribute('responseBody', executionResponse.body || '');
        execution.setAttribute('responseHeaders', headers);

        let body = execution.getAttribute('responseBody') || '';

        const encodingKey = execution.getAttribute('responseHeaders').findIndex(header => header.name === 'x-open-runtimes-encoding');
        if (encodingKey !== -1 && execution.getAttribute('responseHeaders')[encodingKey].value === 'base64') {
            body = Buffer.from(body, 'base64').toString();
        }

        let contentType = 'text/plain';
        for (const header of execution.getAttribute('responseHeaders')) {
            if (header.name.toLowerCase() === 'content-type') {
                contentType = header.value;
            }

            response.setHeader(header.name, header.value);
        }

        response.setContentType(contentType).setStatusCode(execution.getAttribute('responseStatusCode') || 200).send(body);

        return true;
    } else if (type === 'api') {
        utopia.getRoute()?.label('error', '');
        return false;
    } else {
        throw new AppwriteException(AppwriteException.GENERAL_SERVER_ERROR, 'Unknown resource type ' + type);
    }

    utopia.getRoute()?.label('error', '');
    return false;
}

import { App } from 'utopia';
import { Database, Document, Query, ID, Authorization } from 'utopia-database';
import { Request, Response } from 'utopia-request';
import { Event, Usage, Certificate } from 'appwrite-event';
import { AppwriteException } from 'appwrite-extend';
import { System } from 'utopia-system';
import { Config } from 'utopia-config';
import { Executor } from 'executor';
import { Reader } from 'maxmind';
import { SwooleRequest } from 'swoole-http';
import { Locale } from 'utopia-locale';
import { Hostname } from 'utopia-validator';
import { Domain } from 'utopia-domains';

App.init()
    .groups(['database', 'functions', 'storage', 'messaging'])
    .inject('project')
    .inject('request')
    .action((project: Document, request: Request) => {
        if (project.getId() === 'console') {
            const message = !request.getHeader('x-appwrite-project') ?
                'No Appwrite project was specified. Please specify your project ID when initializing your Appwrite SDK.' :
                'This endpoint is not available for the console project. The Appwrite Console is a reserved project ID and cannot be used with the Appwrite SDKs and APIs. Please check if your project ID is correct.';
            throw new AppwriteException(AppwriteException.GENERAL_ACCESS_FORBIDDEN, message);
        }
    });

App.init()
    .groups(['api', 'web'])
    .inject('utopia')
    .inject('swooleRequest')
    .inject('request')
    .inject('response')
    .inject('console')
    .inject('project')
    .inject('dbForConsole')
    .inject('getProjectDB')
    .inject('locale')
    .inject('localeCodes')
    .inject('clients')
    .inject('geodb')
    .inject('queueForUsage')
    .inject('queueForEvents')
    .inject('queueForCertificates')
    .action(async (
        utopia: App,
        swooleRequest: SwooleRequest,
        request: Request,
        response: Response,
        console: Document,
        project: Document,
        dbForConsole: Database,
        getProjectDB: (project: Document) => Database,
        locale: Locale,
        localeCodes: string[],
        clients: string[],
        geodb: Reader,
        queueForUsage: Usage,
        queueForEvents: Event,
        queueForCertificates: Certificate
    ) => {
        /*
        * Appwrite Router
        */
        const host = request.getHostname() || '';
        const mainDomain = System.getEnv('_APP_DOMAIN', '');
        // Only run Router when external domain
        if (host !== mainDomain) {
            if (await router(utopia, dbForConsole, getProjectDB, swooleRequest, request, response, queueForEvents, queueForUsage, geodb)) {
                return;
            }
        }

        /*
        * Request format
        */
        const route = utopia.getRoute();
        Request.setRoute(route);

        if (!route) {
            return response
                .setStatusCode(404)
                .send('Not Found');
        }

        const requestFormat = request.getHeader('x-appwrite-response-format', System.getEnv('_APP_SYSTEM_RESPONSE_FORMAT', ''));
        if (requestFormat) {
            if (versionCompare(requestFormat, '1.4.0') < 0) {
                request.addFilter(new RequestV16());
            }
            if (versionCompare(requestFormat, '1.5.0') < 0) {
                request.addFilter(new RequestV17());
            }
        }

        let domain = request.getHostname();
        const domains = Config.getParam('domains', {});
        if (!domains[domain]) {
            domain = new Domain(domain || '');

            if (!domain.get() || !domain.isKnown() || domain.isTest()) {
                domains[domain.get()] = false;
                console.warn(`${domain.get()} is not a publicly accessible domain. Skipping SSL certificate generation.`);
            } else if (request.getURI().startsWith('/.well-known/acme-challenge')) {
                console.warn('Skipping SSL certificates generation on ACME challenge.');
            } else {
                Authorization.disable();

                const envDomain = System.getEnv('_APP_DOMAIN', '');
                let mainDomain = null;
                if (envDomain && envDomain !== 'localhost') {
                    mainDomain = envDomain;
                } else {
                    const domainDocument = await dbForConsole.findOne('rules', [Query.orderAsc('$id')]);
                    mainDomain = domainDocument ? domainDocument.getAttribute('domain') : domain.get();
                }

                if (mainDomain !== domain.get()) {
                    console.warn(`${domain.get()} is not a main domain. Skipping SSL certificate generation.`);
                } else {
                    let domainDocument = await dbForConsole.findOne('rules', [
                        Query.equal('domain', [domain.get()])
                    ]);

                    if (!domainDocument) {
                        domainDocument = new Document({
                            domain: domain.get(),
                            resourceType: 'api',
                            status: 'verifying',
                            projectId: 'console',
                            projectInternalId: 'console'
                        });

                        domainDocument = await dbForConsole.createDocument('rules', domainDocument);

                        console.info(`Issuing a TLS certificate for the main domain (${domain.get()}) in a few seconds...`);

                        queueForCertificates
                            .setDomain(domainDocument)
                            .setSkipRenewCheck(true)
                            .trigger();
                    }
                }
                domains[domain.get()] = true;

                Authorization.reset(); // ensure authorization is re-enabled
            }
            Config.setParam('domains', domains);
        }

        const localeParam = request.getParam('locale', request.getHeader('x-appwrite-locale', ''));
        if (localeCodes.includes(localeParam)) {
            locale.setDefault(localeParam);
        }

        const referrer = request.getReferer();
        const origin = new URL(request.getOrigin(referrer)).hostname;
        const protocol = new URL(request.getOrigin(referrer)).protocol;
        const port = new URL(request.getOrigin(referrer)).port;

        let refDomainOrigin = 'localhost';
        const validator = new Hostname(clients);
        if (validator.isValid(origin)) {
            refDomainOrigin = origin;
        }

        let refDomain = `${protocol || request.getProtocol()}://${refDomainOrigin}${port ? `:${port}` : ''}`;

        refDomain = !route.getLabel('origin', false)  // This route is publicly accessible
            ? refDomain
            : `${protocol || request.getProtocol()}://${origin}${port ? `:${port}` : ''}`;

        const selfDomain = new Domain(request.getHostname());
        const endDomain = new Domain(origin);

        Config.setParam(
            'domainVerification',
            (selfDomain.getRegisterable() === endDomain.getRegisterable()) &&
                endDomain.getRegisterable() !== ''
        );

        const isLocalHost = request.getHostname() === 'localhost' || request.getHostname() === `localhost:${request.getPort()}`;
        const isIpAddress = Boolean(request.getHostname().match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/));

        const isConsoleProject = project.getAttribute('$id', '') === 'console';
        const isConsoleRootSession = System.getEnv('_APP_CONSOLE_ROOT_SESSION', 'disabled') === 'enabled';

        Config.setParam(
            'cookieDomain',
            isLocalHost || isIpAddress
                ? null
                : (
                    isConsoleProject && isConsoleRootSession
                    ? `.${selfDomain.getRegisterable()}`
                    : `.${request.getHostname()}`
                )
        );

        /*
        * Response format
        */
        const responseFormat = request.getHeader('x-appwrite-response-format', System.getEnv('_APP_SYSTEM_RESPONSE_FORMAT', ''));
        if (responseFormat) {
            if (versionCompare(responseFormat, '1.4.0') < 0) {
                response.addFilter(new ResponseV16());
            }
            if (versionCompare(responseFormat, '1.5.0') < 0) {
                response.addFilter(new ResponseV17());
            }
            if (versionCompare(responseFormat, APP_VERSION_STABLE) > 0) {
                response.addHeader('X-Appwrite-Warning', `The current SDK is built for Appwrite ${responseFormat}. However, the current Appwrite server version is ${APP_VERSION_STABLE}. Please downgrade your SDK to match the Appwrite version: https://appwrite.io/docs/sdks`);
            }
        }

        /*
        * Security Headers
        *
        * As recommended at:
        * @see https://www.owasp.org/index.php/List_of_useful_HTTP_headers
        */
        if (System.getEnv('_APP_OPTIONS_FORCE_HTTPS', 'disabled') === 'enabled') { // Force HTTPS
            if (request.getProtocol() !== 'https' && swooleRequest.header['host'] !== 'localhost' && swooleRequest.header['host'] !== System.getEnv('APP_HOSTNAME_INTERNAL')) { // localhost allowed for proxy, APP_HOSTNAME_INTERNAL allowed for migrations
                if (request.getMethod() !== Request.METHOD_GET) {
                    throw new AppwriteException(AppwriteException.GENERAL_PROTOCOL_UNSUPPORTED, 'Method unsupported over HTTP. Please use HTTPS instead.');
                }

                return response.redirect(`https://${request.getHostname()}${request.getURI()}`);
            }
        }

        if (request.getProtocol() === 'https') {
            response.addHeader('Strict-Transport-Security', `max-age=${60 * 60 * 24 * 126}`); // 126 days
        }

        response
            .addHeader('Server', 'Appwrite')
            .addHeader('X-Content-Type-Options', 'nosniff')
            .addHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE')
            .addHeader('Access-Control-Allow-Headers', 'Origin, Cookie, Set-Cookie, X-Requested-With, Content-Type, Access-Control-Allow-Origin, Access-Control-Request-Headers, Accept, X-Appwrite-Project, X-Appwrite-Key, X-Appwrite-Locale, X-Appwrite-Mode, X-Appwrite-JWT, X-Appwrite-Response-Format, X-Appwrite-Timeout, X-SDK-Version, X-SDK-Name, X-SDK-Language, X-SDK-Platform, X-SDK-GraphQL, X-Appwrite-ID, X-Appwrite-Timestamp, Content-Range, Range, Cache-Control, Expires, Pragma, X-Forwarded-For, X-Forwarded-User-Agent')
            .addHeader('Access-Control-Expose-Headers', 'X-Appwrite-Session, X-Fallback-Cookies')
            .addHeader('Access-Control-Allow-Origin', refDomain)
            .addHeader('Access-Control-Allow-Credentials', 'true');

        /*
        * Validate Client Domain - Check to avoid CSRF attack
        *  Adding Appwrite API domains to allow XDOMAIN communication
        *  Skip this check for non-web platforms which are not required to send an origin header
        */
        const origin = request.getOrigin(request.getReferer(''));
        const originValidator = new Origin([...project.getAttribute('platforms', []), ...console.getAttribute('platforms', [])]);

        if (
            !originValidator.isValid(origin)
            && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.getMethod())
            && route.getLabel('origin', false) !== '*'
            && !request.getHeader('x-appwrite-key', '')
        ) {
            throw new AppwriteException(AppwriteException.GENERAL_UNKNOWN_ORIGIN, originValidator.getDescription());
        }
    });

    import { App } from 'utopia';
import { Database, Document, Query, ID, Authorization } from 'utopia-database';
import { Request, Response } from 'utopia-request';
import { Event, Usage, Certificate } from 'appwrite-event';
import { AppwriteException } from 'appwrite-extend';
import { System } from 'utopia-system';
import { Config } from 'utopia-config';
import { Executor } from 'executor';
import { Reader } from 'maxmind';
import { SwooleRequest } from 'swoole-http';
import { Locale } from 'utopia-locale';
import { Hostname } from 'utopia-validator';
import { Domain } from 'utopia-domains';
import { Logger, Log, User } from 'utopia-logger';
import { DSN } from 'utopia-dsn';
import { View } from 'utopia-view';

App.options()
    .inject('utopia')
    .inject('swooleRequest')
    .inject('request')
    .inject('response')
    .inject('dbForConsole')
    .inject('getProjectDB')
    .inject('queueForEvents')
    .inject('queueForUsage')
    .inject('geodb')
    .action(async (
        utopia: App,
        swooleRequest: SwooleRequest,
        request: Request,
        response: Response,
        dbForConsole: Database,
        getProjectDB: (project: Document) => Database,
        queueForEvents: Event,
        queueForUsage: Usage,
        geodb: Reader
    ) => {
        /*
        * Appwrite Router
        */
        const host = request.getHostname() || '';
        const mainDomain = System.getEnv('_APP_DOMAIN', '');
        // Only run Router when external domain
        if (host !== mainDomain) {
            if (await router(utopia, dbForConsole, getProjectDB, swooleRequest, request, response, queueForEvents, queueForUsage, geodb)) {
                return;
            }
        }

        const origin = request.getOrigin();

        response
            .addHeader('Server', 'Appwrite')
            .addHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE')
            .addHeader('Access-Control-Allow-Headers', 'Origin, Cookie, Set-Cookie, X-Requested-With, Content-Type, Access-Control-Allow-Origin, Access-Control-Request-Headers, Accept, X-Appwrite-Project, X-Appwrite-Key, X-Appwrite-Locale, X-Appwrite-Mode, X-Appwrite-JWT, X-Appwrite-Response-Format, X-Appwrite-Timeout, X-SDK-Version, X-SDK-Name, X-SDK-Language, X-SDK-Platform, X-SDK-GraphQL, X-Appwrite-ID, X-Appwrite-Timestamp, Content-Range, Range, Cache-Control, Expires, Pragma, X-Appwrite-Session, X-Fallback-Cookies, X-Forwarded-For, X-Forwarded-User-Agent')
            .addHeader('Access-Control-Expose-Headers', 'X-Appwrite-Session, X-Fallback-Cookies')
            .addHeader('Access-Control-Allow-Origin', origin)
            .addHeader('Access-Control-Allow-Credentials', 'true')
            .noContent();
    });

App.error()
    .inject('error')
    .inject('utopia')
    .inject('request')
    .inject('response')
    .inject('project')
    .inject('logger')
    .inject('log')
    .inject('queueForUsage')
    .action(async (
        error: Error,
        utopia: App,
        request: Request,
        response: Response,
        project: Document,
        logger: Logger | null,
        log: Log,
        queueForUsage: Usage
    ) => {
        const version = System.getEnv('_APP_VERSION', 'UNKNOWN');
        const route = utopia.getRoute();
        const className = error.constructor.name;
        let code = error instanceof AppwriteException ? error.getCode() : 500;
        let message = error.message;
        const file = error.stack?.split('\n')[1]?.trim() || '';
        const line = error.stack?.split('\n')[2]?.trim() || '';
        const trace = error.stack || '';

        if (process.env.NODE_ENV === 'cli') {
            console.error(`[Error] Timestamp: ${new Date().toISOString()}`);

            if (route) {
                console.error(`[Error] Method: ${route.getMethod()}`);
                console.error(`[Error] URL: ${route.getPath()}`);
            }

            console.error(`[Error] Type: ${className}`);
            console.error(`[Error] Message: ${message}`);
            console.error(`[Error] File: ${file}`);
            console.error(`[Error] Line: ${line}`);
        }

        switch (className) {
            case 'UtopiaException':
                error = new AppwriteException(AppwriteException.GENERAL_UNKNOWN, message, code, error);
                if (code === 400) error.setType(AppwriteException.GENERAL_ARGUMENT_INVALID);
                if (code === 404) error.setType(AppwriteException.GENERAL_ROUTE_NOT_FOUND);
                break;
            case 'ConflictException':
                error = new AppwriteException(AppwriteException.DOCUMENT_UPDATE_CONFLICT, undefined, undefined, error);
                break;
            case 'TimeoutException':
                error = new AppwriteException(AppwriteException.DATABASE_TIMEOUT, undefined, undefined, error);
                break;
            case 'QueryException':
                error = new AppwriteException(AppwriteException.GENERAL_QUERY_INVALID, message, undefined, error);
                break;
            case 'StructureException':
                error = new AppwriteException(AppwriteException.DOCUMENT_INVALID_STRUCTURE, message, undefined, error);
                break;
            case 'DuplicateException':
                error = new AppwriteException(AppwriteException.DOCUMENT_ALREADY_EXISTS, undefined, undefined, error);
                break;
            case 'RestrictedException':
                error = new AppwriteException(AppwriteException.DOCUMENT_DELETE_RESTRICTED, undefined, undefined, error);
                break;
            case 'AuthorizationException':
                error = new AppwriteException(AppwriteException.USER_UNAUTHORIZED, undefined, undefined, error);
                break;
            case 'RelationshipException':
                error = new AppwriteException(AppwriteException.RELATIONSHIP_VALUE_INVALID, message, undefined, error);
                break;
        }

        code = error.getCode();
        message = error.getMessage();

        const publish = error instanceof AppwriteException ? error.isPublishable() : code === 0 || code >= 500;

        if (code >= 400 && code < 500) {
            const providerName = System.getEnv('_APP_EXPERIMENT_LOGGING_PROVIDER', '');
            const providerConfig = System.getEnv('_APP_EXPERIMENT_LOGGING_CONFIG', '');

            if (providerName && providerConfig) {
                if (!Logger.hasProvider(providerName)) {
                    throw new Error("Logging provider not supported. Logging is disabled");
                }

                const AdapterClass = require(`utopia-logger-adapter-${providerName}`);
                const adapter = new AdapterClass(providerConfig);
                logger = new Logger(adapter);
                logger.setSample(0.04);
                publish = true;
            }
        }

        if (publish && project.getId() !== 'console') {
            if (!Authorization.isPrivilegedUser(Authorization.getRoles())) {
                const fileSize = request.getFiles('file')?.size || 0;

                queueForUsage
                    .addMetric('network.requests', 1)
                    .addMetric('network.inbound', request.getSize() + fileSize)
                    .addMetric('network.outbound', response.getSize());
            }

            queueForUsage
                .setProject(project)
                .trigger();
        }

        if (logger && publish) {
            try {
                const user = utopia.getResource('user');
                if (user && !user.isEmpty()) {
                    log.setUser(new User(user.getId()));
                }
            } catch (e) {
                // All good, user is optional information for logger
            }

            try {
                const dsn = new DSN(project.getAttribute('database', 'console'));
                log.addTag('database', dsn.getHost());
            } catch (e) {
                const dsn = new DSN(`mysql://${project.getAttribute('database', 'console')}`);
                log.addTag('database', dsn.getHost());
            }

            log.setNamespace("http");
            log.setServer(require('os').hostname());
            log.setVersion(version);
            log.setType(Log.TYPE_ERROR);
            log.setMessage(message);

            log.addTag('method', route.getMethod());
            log.addTag('url', route.getPath());
            log.addTag('verboseType', className);
            log.addTag('code', code);
            log.addTag('projectId', project.getId());
            log.addTag('hostname', request.getHostname());
            log.addTag('locale', request.getParam('locale', request.getHeader('x-appwrite-locale', '')));

            log.addExtra('file', file);
            log.addExtra('line', line);
            log.addExtra('trace', trace);
            log.addExtra('roles', Authorization.getRoles());

            const action = `${route.getLabel("sdk.namespace", "UNKNOWN_NAMESPACE")}.${route.getLabel("sdk.method", "UNKNOWN_METHOD")}`;
            log.setAction(action);

            const isProduction = System.getEnv('_APP_ENV', 'development') === 'production';
            log.setEnvironment(isProduction ? Log.ENVIRONMENT_PRODUCTION : Log.ENVIRONMENT_STAGING);

            const responseCode = await logger.addLog(log);
            console.info(`Log pushed with status code: ${responseCode}`);
        }

        if (!(error instanceof AppwriteException)) {
            error = new AppwriteException(AppwriteException.GENERAL_UNKNOWN, message, code, error);
        }

        switch (code) {
            case 400:
            case 401:
            case 402:
            case 403:
            case 404:
            case 408:
            case 409:
            case 412:
            case 416:
            case 429:
            case 451:
            case 501:
            case 503:
                break;
            default:
                code = 500;
                message = 'Server Error';
        }

        const type = error.getType();

        const output = App.isDevelopment() ? {
            message,
            code,
            file,
            line,
            trace: JSON.stringify(trace, null, 2),
            version: System.getEnv('APP_VERSION_STABLE'),
            type,
        } : {
            message,
            code,
            version: System.getEnv('APP_VERSION_STABLE'),
            type,
        };

        response
            .addHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
            .addHeader('Expires', '0')
            .addHeader('Pragma', 'no-cache')
            .setStatusCode(code);

        const template = route ? route.getLabel('error', null) : null;

        if (template) {
            const layout = new View(template);

            layout
                .setParam('title', `${project.getAttribute('name')} - Error`)
                .setParam('development', App.isDevelopment())
                .setParam('projectName', project.getAttribute('name'))
                .setParam('projectURL', project.getAttribute('url'))
                .setParam('message', output.message || '')
                .setParam('type', output.type || '')
                .setParam('code', output.code || '')
                .setParam('trace', output.trace || []);

            response.html(layout.render());
        }

        response.dynamic(
            new Document(output),
            App.isDevelopment() ? Response.MODEL_ERROR_DEV : Response.MODEL_ERROR
        );
    });


    

    import { App } from 'utopia';
    import { Database, Document, Query, ID, Authorization } from 'utopia-database';
    import { Request, Response } from 'utopia-request';
    import { Event, Usage, Certificate } from 'appwrite-event';
    import { AppwriteException } from 'appwrite-extend';
    import { System } from 'utopia-system';
    import { Config } from 'utopia-config';
    import { Executor } from 'executor';
    import { Reader } from 'maxmind';
    import { SwooleRequest } from 'swoole-http';
    import { Locale } from 'utopia-locale';
    import { Hostname } from 'utopia-validator';
    import { Domain } from 'utopia-domains';
    import { Logger, Log, User } from 'utopia-logger';
    import { DSN } from 'utopia-dsn';
    import { View } from 'utopia-view';
    import { Text } from 'utopia-validator';
    
    App.get('/robots.txt')
        .desc('Robots.txt File')
        .label('scope', 'public')
        .label('docs', false)
        .inject('utopia')
        .inject('swooleRequest')
        .inject('request')
        .inject('response')
        .inject('dbForConsole')
        .inject('getProjectDB')
        .inject('queueForEvents')
        .inject('queueForUsage')
        .inject('geodb')
        .action(async (
            utopia: App,
            swooleRequest: SwooleRequest,
            request: Request,
            response: Response,
            dbForConsole: Database,
            getProjectDB: (project: Document) => Database,
            queueForEvents: Event,
            queueForUsage: Usage,
            geodb: Reader
        ) => {
            const host = request.getHostname() || '';
            const mainDomain = System.getEnv('_APP_DOMAIN', '');
    
            if (host === mainDomain) {
                const template = new View(__dirname + '/../views/general/robots.phtml');
                response.text(template.render(false));
            } else {
                await router(utopia, dbForConsole, getProjectDB, swooleRequest, request, response, queueForEvents, queueForUsage, geodb);
            }
        });
    
    App.get('/humans.txt')
        .desc('Humans.txt File')
        .label('scope', 'public')
        .label('docs', false)
        .inject('utopia')
        .inject('swooleRequest')
        .inject('request')
        .inject('response')
        .inject('dbForConsole')
        .inject('getProjectDB')
        .inject('queueForEvents')
        .inject('queueForUsage')
        .inject('geodb')
        .action(async (
            utopia: App,
            swooleRequest: SwooleRequest,
            request: Request,
            response: Response,
            dbForConsole: Database,
            getProjectDB: (project: Document) => Database,
            queueForEvents: Event,
            queueForUsage: Usage,
            geodb: Reader
        ) => {
            const host = request.getHostname() || '';
            const mainDomain = System.getEnv('_APP_DOMAIN', '');
    
            if (host === mainDomain) {
                const template = new View(__dirname + '/../views/general/humans.phtml');
                response.text(template.render(false));
            } else {
                await router(utopia, dbForConsole, getProjectDB, swooleRequest, request, response, queueForEvents, queueForUsage, geodb);
            }
        });
    
    App.get('/.well-known/acme-challenge/*')
        .desc('SSL Verification')
        .label('scope', 'public')
        .label('docs', false)
        .inject('request')
        .inject('response')
        .action(async (request: Request, response: Response) => {
            const uriChunks = request.getURI().split('/');
            const token = uriChunks[uriChunks.length - 1];
    
            const validator = new Text(100, {
                allowList: [
                    ...Text.NUMBERS,
                    ...Text.ALPHABET_LOWER,
                    ...Text.ALPHABET_UPPER,
                    '-',
                    '_'
                ]
            });
    
            if (!validator.isValid(token) || uriChunks.length !== 4) {
                throw new AppwriteException(AppwriteException.GENERAL_ARGUMENT_INVALID, 'Invalid challenge token.');
            }
    
            const base = realpath(APP_STORAGE_CERTIFICATES);
            const absolute = realpath(`${base}/.well-known/acme-challenge/${token}`);
    
            if (!base) {
                throw new AppwriteException(AppwriteException.GENERAL_SERVER_ERROR, 'Storage error');
            }
    
            if (!absolute) {
                throw new AppwriteException(AppwriteException.GENERAL_ROUTE_NOT_FOUND, 'Unknown path');
            }
    
            if (!absolute.startsWith(base)) {
                throw new AppwriteException(AppwriteException.GENERAL_UNAUTHORIZED_SCOPE, 'Invalid path');
            }
    
            if (!fileExists(absolute)) {
                throw new AppwriteException(AppwriteException.GENERAL_ROUTE_NOT_FOUND, 'Unknown path');
            }
    
            const content = await fileGetContents(absolute);
    
            if (!content) {
                throw new AppwriteException(AppwriteException.GENERAL_SERVER_ERROR, 'Failed to get contents');
            }
    
            response.text(content);
        });
    
    import './shared/api';
    import './shared/api/auth';
    
    App.wildcard()
        .groups(['api'])
        .label('scope', 'global')
        .action(() => {
            throw new AppwriteException(AppwriteException.GENERAL_ROUTE_NOT_FOUND);
        });
    
    for (const service of Config.getParam('services', [])) {
        import(service.controller);
    }