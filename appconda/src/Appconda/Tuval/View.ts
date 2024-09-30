import { View as OldView } from '@tuval/core';

export class View extends OldView {
    /**
     * Escape
     *
     * Convert all applicable characters to HTML entities
     *
     * @param str - The string to escape
     * @returns The escaped string
     * @deprecated Use print method with escape filter
     */
    public escape(str: string): string {
        return str.replace(/[\u00A0-\u9999<>\&]/gim, function(i) {
            return '&#' + i.charCodeAt(0) + ';';
        });
    }
}
