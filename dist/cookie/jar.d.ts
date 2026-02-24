/*!
 * @sptzx/request — MIT License
 * Derived from tough-cookie — BSD-3-Clause © Salesforce.com, Inc.
 * Derived from set-cookie-parser — MIT License © Nat Friedman
 */
import type { Cookie } from "./types.js";
export declare class CookieJar {
    #private;
    constructor();
    setCookiesFromResponse(response: Response, requestUrl: string): void;
    getCookieHeaderForRequest(requestUrl: string): string;
    clear(): void;
    getAll(): Cookie[];
}
//# sourceMappingURL=jar.d.ts.map