import e from "express";
import { BaseService } from "../BaseService";
import { ExpressApp } from "tuval";

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


    ExpressApp.start(80, '0.0.0.0');

    var fs = require("fs");
    var path = require("path");

    var coreServices =path.resolve(__dirname, "../app/controllers") ;
    console.log(coreServices);

    const filenames = fs.readdirSync(coreServices);
    filenames.forEach(function (file, index) {
      // Make one pass and make the file complete
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
    });




  }


  async init() {
    console.log('-----------------web server-------')
    const router = this.getRouter();
    router.get('', (req: e.Request, res: e.Response) => {
      res.send('OK')
    })

  }



}

