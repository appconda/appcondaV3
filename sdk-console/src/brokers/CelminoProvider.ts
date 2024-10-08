

import { Account, Client, Databases, Projects, Storage, Teams, Users } from "../";


const url = location.port != null ? `${location.protocol}//${location.hostname}:${location.port}/v1`
    : `${location.protocol}//${location.hostname}/v1`;


export const client = new Client()
    .setEndpoint(url);
client.setEndpointRealtime('ws://localhost:9505/v1');

export const getClient = (): Client => {
    return client;
}

client.subscribe('console', response => {
    // Callback will be executed on all account events.
    console.log(response);
});



export const Services = {
    Client: client,
    Accounts: new Account(client),
    Projects: new Projects(client),
    Teams: new Teams(client),
    Users: new Users(client),
    Databases: new Databases(client),
    Storage: new Storage(client)
}

