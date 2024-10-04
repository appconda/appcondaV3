import { Hook } from "@tuval/core";


export class Task extends Hook {
    protected name: string = '';

    constructor(name: string) {
        super();
        this.name = name;
        (this as any).action = () => {};
    }

    public getName(): string {
        return this.name;
    }
}