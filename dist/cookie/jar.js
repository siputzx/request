/*!
 * @sptzx/request — MIT License
 * Derived from tough-cookie — BSD-3-Clause © Salesforce.com, Inc.
 * Derived from set-cookie-parser — MIT License © Nat Friedman
 */
import { CookieStore } from "./store.js";
import { parseSetCookieString, extractSetCookieHeaders } from "./parser.js";
import { canonicalDomain, domainMatch } from "./domain.js";
import { defaultCookiePath } from "./path.js";
export class CookieJar {
    #store;
    constructor() {
        this.#store = new CookieStore();
    }
    setCookiesFromResponse(response, requestUrl) {
        const setCookieHeaders = extractSetCookieHeaders(response.headers);
        if (setCookieHeaders.length === 0)
            return;
        const url = new URL(requestUrl);
        const requestDomain = canonicalDomain(url.hostname);
        const requestPath = url.pathname || "/";
        for (let i = 0; i < setCookieHeaders.length; i++) {
            const parsed = parseSetCookieString(setCookieHeaders[i]);
            if (!parsed)
                continue;
            const cookieDomain = parsed.domain ? canonicalDomain(parsed.domain) : requestDomain;
            if (!cookieDomain)
                continue;
            if (parsed.domain && !domainMatch(requestDomain, cookieDomain))
                continue;
            this.#store.putCookie({
                ...parsed,
                domain: cookieDomain,
                path: parsed.path ?? defaultCookiePath(requestPath),
                hostOnly: !parsed.domain,
            });
        }
    }
    getCookieHeaderForRequest(requestUrl) {
        const url = new URL(requestUrl);
        const domain = canonicalDomain(url.hostname);
        if (!domain)
            return "";
        const path = url.pathname || "/";
        const isSecure = url.protocol === "https:";
        const cookies = this.#store.findCookiesForDomain(domain, path);
        let len = cookies.length;
        for (let i = len - 1; i >= 0; i--) {
            const c = cookies[i];
            if ((c.secure && !isSecure) || (c.hostOnly && c.domain !== domain)) {
                cookies[i] = cookies[--len];
            }
        }
        cookies.length = len;
        cookies.sort((a, b) => {
            const diff = (b.path?.length ?? 1) - (a.path?.length ?? 1);
            return diff !== 0 ? diff : (a.creationTime - b.creationTime);
        });
        let header = "";
        for (let i = 0; i < cookies.length; i++) {
            if (i > 0)
                header += "; ";
            header += cookies[i].name + "=" + cookies[i].value;
        }
        return header;
    }
    clear() {
        this.#store.removeAllCookies();
    }
    getAll() {
        return this.#store.getAllCookies();
    }
}
//# sourceMappingURL=jar.js.map