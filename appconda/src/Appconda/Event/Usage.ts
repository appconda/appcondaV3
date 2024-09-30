import { Document } from '@tuval/core';
import { Client } from '@tuval/queue';
import { Connection } from '@tuval/queue';
import { Event } from './Event';

export class Usage extends Event {
    protected metrics: { key: string, value: number }[] = [];
    protected reduce: Document[] = [];

    constructor(protected connection: Connection) {
        super(connection);
        this
            .setQueue(Event.USAGE_QUEUE_NAME)
            .setClass(Event.USAGE_CLASS_NAME);
    }

    public addReduce(document: Document): this {
        this.reduce.push(document);
        return this;
    }

    public addMetric(key: string, value: number): this {
        this.metrics.push({ key, value });
        return this;
    }

    public async trigger(): Promise<string | boolean> {
        const client = new Client(this.queue, this.connection);
        return client.enqueue({
            project: this.getProject(),
            reduce: this.reduce,
            metrics: this.metrics,
        });
    }
}