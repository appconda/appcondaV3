
export abstract class Validator  {
    public static readonly TYPE_BOOLEAN = 'boolean';
    public static readonly TYPE_INTEGER = 'integer';
    public static readonly TYPE_FLOAT = 'double'; // gettype() returns 'double' for historical reasons
    public static readonly TYPE_STRING = 'string';
    public static readonly TYPE_ARRAY = 'array';
    public static readonly TYPE_OBJECT = 'object';
    public static readonly TYPE_MIXED = 'mixed';

    abstract getDescription(): string;
    abstract isValid(name: any): boolean;
    abstract isArray(): boolean;
    abstract getType(): string;
}