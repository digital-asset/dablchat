import {Plugin} from "vite";
import http from "http";
import * as daml from "./daml-client-thin";
import * as fs from 'fs';

export const httpJsonApi = 'http://127.0.0.1:7575';
daml.setBaseUrl(httpJsonApi);

function renderHtmlPage(res: http.ServerResponse, contents: string) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'max-age=0, no-cache, must-revalidate, proxy-revalidate');
    res.write(contents);
    res.end();
}

function renderPublicToken(res: http.ServerResponse) {
    daml.listKnownParties().then((parties) => {
        const publicPartyDetails = parties.find(p => p.displayName === 'Public')
        const access_token = mintToken({sub: 'anonymous', party: publicPartyDetails!.identifier });
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'max-age=0, no-cache, must-revalidate, proxy-revalidate');
        res.write(JSON.stringify({access_token}));
        res.end();
    });
}

function renderDefaultParties(res: http.ServerResponse) {
    daml.listKnownParties().then((parties) => {
        const result = parties.filter(p => p.displayName === 'Public' || p.displayName === 'UserAdmin');
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'max-age=0, no-cache, must-revalidate, proxy-revalidate');
        res.write(JSON.stringify({result}));
        res.end();
    });
}

interface TokenRequest {
    sub?: string | null;
    party?: string | null;
}

function mintToken({ sub, party }: TokenRequest): string {
    const header = {typ: "JWT", alg: "HS256"};

    if (!sub) {
        // all Daml Hub tokens have `sub` claims on them, even party-based ones, and Daml Chat also
        // requires `sub` for display purposes
        sub = party || 'unnamed';
    }

    let payload: any = { sub };
    if (party) {
        payload["https://daml.com/ledger-api"]= {
            "ledgerId": "sandbox",
                "applicationId": "damlhub",
                "actAs": [party]
        }
    }

    return `${encodeJWTComponent(header)}.${encodeJWTComponent(payload)}.invalidsig`;
}

function encodeJWTComponent(obj: any): string {
    return btoa(JSON.stringify(obj))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

function buildPlugin(): Plugin {
    return {
        name: 'damlhub-mock',
        configureServer: (server) => {
            server.middlewares.use( (req, res, next) => {
                const {pathname, searchParams} = new URL(`http://localhost${req.url}`);
                switch (pathname) {
                    case '/.hub/v1/auth/login':
                        renderHtmlPage(res, fs.readFileSync(`${__dirname}/v1.html`, 'utf-8'));
                        break;

                    case '/.hub/v2/auth/login':
                        renderHtmlPage(res, fs.readFileSync(`${__dirname}/v2.html`, 'utf-8'));
                        break;

                    case '/.hub/local-mock/finish':
                        console.log('finishing the login flow...');
                        const token = mintToken({
                            sub:searchParams.get("sub"),
                            party: searchParams.get("party")
                        })

                        res.statusCode = 302;
                        res.setHeader("Location", `http://${req.headers.host}/`)
                        res.setHeader('Cache-Control', 'max-age=0, no-cache, must-revalidate, proxy-revalidate');
                        res.setHeader("Set-Cookie", `DAMLHUB_LEDGER_ACCESS_TOKEN=${token}; Path=/`);
                        res.end();
                        console.log('login flow finished.')
                        break;

                    case '/.hub/v1/public/token':
                        renderPublicToken(res);
                        break;

                    case '/.hub/v1/default-parties':
                        renderDefaultParties(res);
                        break;

                    default:
                        next();
                }
            });
        }
    }
}

export default buildPlugin;
