import { Request } from "../../../Appconda/Tuval/Request";
import { Response } from "../../../Appconda/Tuval/Response";
import { App } from "../../../Tuval/Http/App";
import { parse } from "url";

App.init()
    .groups(['web'])
    .inject('request')
    .inject('response')
    .action((request: Request, response: Response) => {
        response
            .addHeader('X-Frame-Options', 'SAMEORIGIN')
            .addHeader('X-XSS-Protection', '1; mode=block; report=/v1/xss?url=' + encodeURIComponent(request.getURI()))
            .addHeader('X-UA-Compatible', 'IE=Edge');
    });

App.get('/')
    .alias('auth/*')
    .alias('/invite')
    .alias('/login')
    .alias('/mfa')
    .alias('/card/*')
    .alias('/recover')
    .alias('/register/*')
    .groups(['web'])
    .label('permission', 'public')
    .label('scope', 'home')
    .inject('request')
    .inject('response')
    .action((request: Request, response: Response) => {
        const url = parse(request.getURI(), true);
        let target = `/console${url.pathname}`;
        const params = request.getParams();
        if (Object.keys(params).length > 0) {
            target += "?" + new URLSearchParams(params).toString();
        }
        if (url.hash) {
            target += url.hash;
        }
        response.redirect(target);
    });