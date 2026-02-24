/*!
 * @sptzx/request — MIT License
 * Derived from tough-cookie — BSD-3-Clause © Salesforce.com, Inc.
 */
export type SameSite = "Strict" | "Lax" | "None" | string;
export interface Cookie {
    name: string;
    value: string;
    domain?: string;
    path?: string;
    expires?: Date;
    maxAge?: number;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: SameSite;
    partitioned?: boolean;
    creationTime: number;
    lastAccessTime: number;
    hostOnly?: boolean;
}
export type CookieStoreIndex = {
    [domain: string]: {
        [path: string]: {
            [name: string]: Cookie;
        };
    };
};
export declare const MAX_COOKIES_PER_DOMAIN = 50;
export declare const MAX_COOKIE_VALUE_LENGTH = 4096;
//# sourceMappingURL=types.d.ts.map