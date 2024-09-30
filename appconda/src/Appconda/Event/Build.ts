import { Document } from '@tuval/core';
import { Client } from '@tuval/queue';
import { Connection } from '@tuval/queue';
import { Event } from './Event';

export class Build extends Event {
    protected type: string = '';
    protected resource: Document | null = null;
    protected deployment: Document | null = null;
    protected template: Document | null = null;

    constructor(protected connection: Connection) {
        super(connection);
        this
            .setQueue(Event.BUILDS_QUEUE_NAME)
            .setClass(Event.BUILDS_CLASS_NAME);
    }

    public setTemplate(template: Document): this {
        this.template = template;
        return this;
    }

    public setResource(resource: Document): this {
        this.resource = resource;
        return this;
    }

    public getResource(): Document | null {
        return this.resource;
    }

    public setDeployment(deployment: Document): this {
        this.deployment = deployment;
        return this;
    }

    public getDeployment(): Document | null {
        return this.deployment;
    }

    public setType(type: string): this {
        this.type = type;
        return this;
    }

    public getType(): string {
        return this.type;
    }

    public async trigger(): Promise<string | boolean> {
        const client = new Client(this.queue, this.connection);
        return client.enqueue({
            project: this.project,
            resource: this.resource,
            deployment: this.deployment,
            type: this.type,
            template: this.template
        });
    }

    public reset(): this {
        this.type = '';
        this.resource = null;
        this.deployment = null;
        this.template = null;
        super.reset();
        return this;
    }
}