/*!
 * @sptzx/request — MIT License
 * Derived from tough-cookie — BSD-3-Clause © Salesforce.com, Inc.
 */
import { MAX_COOKIES_PER_DOMAIN } from "./types.js";
import { domainMatch, permuteDomain } from "./domain.js";
import { pathMatch } from "./path.js";
const now = () => Date.now();
function isExpired(cookie) {
    if (cookie.maxAge !== undefined)
        return now() - cookie.creationTime >= cookie.maxAge * 1000;
    if (cookie.expires)
        return cookie.expires.getTime() < now();
    return false;
}
export class CookieStore {
    #idx = Object.create(null);
    #domainCount = new Map();
    findCookie(domain, path, name) {
        return this.#idx[domain]?.[path]?.[name];
    }
    findCookiesForDomain(domain, path) {
        const cookies = [];
        const dominated = permuteDomain(domain);
        for (let d = 0; d < dominated.length; d++) {
            const dom = dominated[d];
            const domainEntry = this.#idx[dom];
            if (!domainEntry)
                continue;
            const pathKeys = Object.keys(domainEntry);
            for (let p = 0; p < pathKeys.length; p++) {
                const cookiePath = pathKeys[p];
                if (path !== null && !pathMatch(path, cookiePath))
                    continue;
                const pathEntry = domainEntry[cookiePath];
                const nameKeys = Object.keys(pathEntry);
                for (let n = 0; n < nameKeys.length; n++) {
                    const cookie = pathEntry[nameKeys[n]];
                    if (isExpired(cookie))
                        continue;
                    if (cookie.domain && !domainMatch(domain, cookie.domain))
                        continue;
                    cookies.push(cookie);
                }
            }
        }
        return cookies;
    }
    putCookie(cookie) {
        const domain = cookie.domain ?? "";
        const path = cookie.path ?? "/";
        const name = cookie.name;
        let domainEntry = this.#idx[domain];
        if (!domainEntry) {
            domainEntry = Object.create(null);
            this.#idx[domain] = domainEntry;
        }
        let pathEntry = domainEntry[path];
        if (!pathEntry) {
            pathEntry = Object.create(null);
            domainEntry[path] = pathEntry;
        }
        const isNew = !(name in pathEntry);
        if (isNew) {
            const currentCount = this.#domainCount.get(domain) ?? 0;
            if (currentCount >= MAX_COOKIES_PER_DOMAIN) {
                this.#evictOldestForDomain(domain, domainEntry);
            }
            this.#domainCount.set(domain, (this.#domainCount.get(domain) ?? 0) + 1);
        }
        pathEntry[name] = cookie;
    }
    #evictOldestForDomain(domain, domainEntry) {
        let oldest;
        let oldestPath;
        let oldestName;
        const pathKeys = Object.keys(domainEntry);
        for (let p = 0; p < pathKeys.length; p++) {
            const cookiePath = pathKeys[p];
            const pathEntry = domainEntry[cookiePath];
            const nameKeys = Object.keys(pathEntry);
            for (let n = 0; n < nameKeys.length; n++) {
                const c = pathEntry[nameKeys[n]];
                if (!oldest || c.creationTime < oldest.creationTime) {
                    oldest = c;
                    oldestPath = cookiePath;
                    oldestName = nameKeys[n];
                }
            }
        }
        if (oldestPath && oldestName) {
            delete domainEntry[oldestPath][oldestName];
            const count = this.#domainCount.get(domain) ?? 1;
            this.#domainCount.set(domain, Math.max(0, count - 1));
        }
    }
    removeCookie(domain, path, name) {
        if (this.#idx[domain]?.[path]?.[name]) {
            delete this.#idx[domain][path][name];
            const count = this.#domainCount.get(domain) ?? 1;
            this.#domainCount.set(domain, Math.max(0, count - 1));
        }
    }
    removeAllCookies() {
        const keys = Object.keys(this.#idx);
        for (let i = 0; i < keys.length; i++)
            delete this.#idx[keys[i]];
        this.#domainCount.clear();
    }
    getAllCookies() {
        const result = [];
        const domains = Object.keys(this.#idx);
        for (let d = 0; d < domains.length; d++) {
            const domainEntry = this.#idx[domains[d]];
            const paths = Object.keys(domainEntry);
            for (let p = 0; p < paths.length; p++) {
                const pathEntry = domainEntry[paths[p]];
                const names = Object.keys(pathEntry);
                for (let n = 0; n < names.length; n++) {
                    const c = pathEntry[names[n]];
                    if (!isExpired(c))
                        result.push(c);
                }
            }
        }
        return result;
    }
}
//# sourceMappingURL=store.js.map