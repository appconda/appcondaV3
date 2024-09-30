import { Response } from '../../Response';
import { Error } from './Error';

export class ErrorDev extends Error {
    protected public: boolean = false;

    constructor() {
        super();

        this
            .addRule('file', {
                type: Error.TYPE_STRING,
                description: 'File path.',
                default: '',
                example: '/usr/code/vendor/utopia-php/framework/src/App.php',
            })
            .addRule('line', {
                type: Error.TYPE_INTEGER,
                description: 'Line number.',
                default: 0,
                example: 209,
            })
            .addRule('trace', {
                type: Error.TYPE_STRING,
                description: 'Error trace.',
                default: [],
                example: '',
                array: true,
            });
    }

    /**
     * Get Type
     *
     * @return string
     */
    public getType(): string {
        return Response.MODEL_ERROR_DEV;
    }
}