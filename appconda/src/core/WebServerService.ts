import e from "express";
import { BaseService } from "../BaseService";
import { App, Request, Response } from "../Tuval/Http";
import path from "path";
import { register } from "../app/controllers/general";
import { Files } from "../Tuval/Http/Adapters/express/Files";
import { Authorization, Role } from "@tuval/core";
import { Log, User } from "@tuval/logger";
import { Console } from "@tuval/cli";
const express = require('express');
var cors = require('cors')



export default class WebServerService extends BaseService {

  public get uid(): string {
    return 'com.realmocean.service.web';
  }

  get displayName(): string {
    return 'Web Service'
  }



  app: any;
  router: any;

  /*  static  getInstance(args) {
    const _ = new WebServerService(args);
    _._init();
    return _.app;
  } */

  getExpressApp() {
    return this.app;
  }

  getRouter() {
    return this.router;
  }

  async construct() {
    const app = express();

    app.use(cors({
      credentials: true,
      preflightContinue: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      origin: true
    }));
    /*  app.use(cors({
       allowedHeaders: ['x-github-username', 'x-github-repo', ['x-github-token']]
     })) */
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));



    this.app = app;
    app.set('services', this.services);
    // app.listen(80, () => console.log("listening on port 80"));

    this.router = express.Router();
    app.use('/v1/service', this.router)


    Files.load(path.resolve(__dirname, '../app/console'));


    const _path = path.resolve('./src/app/controllers/general');
    console.log(register)


    app.use(async (req, res, next) => {
      const request = new Request(req);
      const response = new Response(res);
      App.setResource('expressRequest', async () => req); // Wrap Request in a function
      App.setResource('expressResponse', async () => res);

      if (Files.isFileLoaded(request.getURI())) {
        const time = (60 * 60 * 24 * 365 * 2); // 45 days cache

        response
          .setContentType(Files.getFileMimeType(request.getURI()))
          .addHeader('Cache-Control', 'public, max-age=' + time)
          .addHeader('Expires', new Date(Date.now() + time * 1000).toUTCString())
          .send(Files.getFileContents(request.getURI()));

        return;
      }

      const app = new App('UTC');


      const pools = register.get('pools');
      App.setResource('pools', async () => {
        return pools;
      });


      try {
        Authorization.cleanRoles();
        Authorization.setRole(Role.any().toString());

        app.run(request, response);
      } catch (th) {
        const version = process.env._APP_VERSION || 'UNKNOWN';

        const logger = await app.getResource("logger");
        if (logger) {
          let user;
          try {
            user = app.getResource('user');
          } catch (_th) {
            // All good, user is optional information for logger
          }

          const route = app.getRoute();
          const log = await app.getResource("log");

          if (user && !user.isEmpty()) {
            log.setUser(new User(user.getId()));
          }

          log.setNamespace("http");
          log.setServer(require('os').hostname());
          log.setVersion(version);
          log.setType(Log.TYPE_ERROR);
          log.setMessage(th.message);

          log.addTag('method', route.getMethod());
          log.addTag('url', route.getPath());
          log.addTag('verboseType', th.constructor.name);
          log.addTag('code', th.code);
          log.addTag('hostname', request.getHostname());
          log.addTag('locale', request.getParam('locale') || request.getHeader('x-appconda-locale') || '');

          log.addExtra('file', th.fileName);
          log.addExtra('line', th.lineNumber);
          log.addExtra('trace', th.stack);
          log.addExtra('roles', Authorization.getRoles());

          const action = `${route.getLabel("sdk.namespace", "UNKNOWN_NAMESPACE")}.${route.getLabel("sdk.method", "UNKNOWN_METHOD")}`;
          log.setAction(action);

          const isProduction = process.env._APP_ENV === 'production';
          log.setEnvironment(isProduction ? Log.ENVIRONMENT_PRODUCTION : Log.ENVIRONMENT_STAGING);

          const responseCode = logger.addLog(log);
          Console.info('Log pushed with status code: ' + responseCode);
        }

        Console.error('[Error] Type: ' + th.constructor.name);
        Console.error('[Error] Message: ' + th.message);
        Console.error('[Error] File: ' + th.fileName);
        Console.error('[Error] Line: ' + th.lineNumber);

        response.setStatusCode(500);

        const output = App.isDevelopment() ? {
          message: 'Error: ' + th.message,
          code: 500,
          file: th.fileName,
          line: th.lineNumber,
          trace: th.stack,
          version: version,
        } : {
          message: 'Error: Server Error',
          code: 500,
          version: version,
        };

        response.json(output);
      } finally {
        pools.reclaim();
      }

      //next()
    })

    app.listen(80, '0.0.0.0');
    //ExpressApp.start(80, '0.0.0.0');

    /*     var fs = require("fs");
        var path = require("path");
    
        var coreServices =path.resolve(__dirname, "../app/controllers") ;
        console.log(coreServices);
    
        const filenames = fs.readdirSync(coreServices);
        filenames.forEach(function (file, index) {
          var fromPath = path.join(coreServices, file);
    
          const stat = fs.statSync(fromPath);
    
          if (stat.isFile()) {
            console.log(path.resolve(fromPath));
            try {
              const service = require(path.resolve(fromPath));
            } catch (e) {
              console.log(e);
            }
          } else if (stat.isDirectory()) console.log(fromPath);
        }); */




  }


  async init() {
    console.log('-----------------web server-------')
    const router = this.getRouter();
    router.get('', (req: e.Request, res: e.Response) => {
      res.send('OK')
    })

  }



}

