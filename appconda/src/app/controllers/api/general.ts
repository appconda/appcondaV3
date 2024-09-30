import { App, Request, Response } from "tuval";

App
    .get('/v1/test/:id/:name')
    .desc('Get all users')
    
    .inject('request')
    .inject('response')
    .action(( req: Request, res: Response) => {
        res.send('Hello');
    });