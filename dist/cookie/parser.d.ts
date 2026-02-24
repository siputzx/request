/*!
 * @sptzx/request — MIT License
 * Derived from set-cookie-parser — MIT License © Nat Friedman
 * Derived from tough-cookie — BSD-3-Clause © Salesforce.com, Inc.
 */
import type { Cookie } from "./types.js";
export declare function parseSetCookieString(setCookieValue: string): Cookie | null;
export declare function splitCookiesString(cookiesString: string | string[]): string[];
export declare function extractSetCookieHeaders(headers: Headers): string[];
//# sourceMappingURL=parser.d.ts.map