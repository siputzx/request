/*!
 * @sptzx/request — MIT License
 * Derived from tough-cookie — BSD-3-Clause © Salesforce.com, Inc.
 */
import type { Cookie } from "./types.js";
export declare class CookieStore {
    #private;
    findCookie(domain: string, path: string, name: string): Cookie | undefined;
    findCookiesForDomain(domain: string, path: string | null): Cookie[];
    putCookie(cookie: Cookie): void;
    removeCookie(domain: string, path: string, name: string): void;
    removeAllCookies(): void;
    getAllCookies(): Cookie[];
}
//# sourceMappingURL=store.d.ts.map