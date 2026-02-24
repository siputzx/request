/*!
 * @sptzx/request — MIT License
 * Derived from set-cookie-parser — MIT License © Nat Friedman
 * Derived from tough-cookie — BSD-3-Clause © Salesforce.com, Inc.
 */
import { MAX_COOKIE_VALUE_LENGTH } from "./types.js";
const CONTROL_CHAR_RE = /[\x00-\x1F]/;
function trimTerminator(str) {
    let end = str.length;
    for (let i = 0; i < end; i++) {
        const c = str.charCodeAt(i);
        if (c === 0x0a || c === 0x0d || c === 0x00) {
            end = i;
            break;
        }
    }
    return end === str.length ? str : str.slice(0, end);
}
function isNonEmptyString(str) {
    return typeof str === "string" && str.trim().length > 0;
}
export function parseSetCookieString(setCookieValue) {
    if (!isNonEmptyString(setCookieValue))
        return null;
    const now = Date.now();
    // Check full string for control chars BEFORE trimming terminators
    const semiFirstIdx = setCookieValue.indexOf(";");
    const rawNV = semiFirstIdx === -1 ? setCookieValue : setCookieValue.slice(0, semiFirstIdx);
    if (CONTROL_CHAR_RE.test(rawNV))
        return null;
    const trimmed = trimTerminator(setCookieValue);
    const semiIdx = trimmed.indexOf(";");
    const nameValueStr = semiIdx === -1 ? trimmed : trimmed.slice(0, semiIdx);
    const eqIdx = nameValueStr.indexOf("=");
    let name;
    let value;
    if (eqIdx <= 0) {
        name = "";
        value = nameValueStr.trim();
    }
    else {
        name = nameValueStr.slice(0, eqIdx).trim();
        value = nameValueStr.slice(eqIdx + 1).trim();
    }
    if (CONTROL_CHAR_RE.test(name))
        return null;
    if (value.length > MAX_COOKIE_VALUE_LENGTH)
        return null;
    let decodedValue = value;
    if (value.includes("%")) {
        try {
            decodedValue = decodeURIComponent(value);
        }
        catch {
            decodedValue = value;
        }
    }
    const cookie = { name, value: decodedValue, creationTime: now, lastAccessTime: now };
    if (semiIdx === -1)
        return cookie;
    let pos = semiIdx + 1;
    const len = trimmed.length;
    while (pos < len) {
        let attrEnd = trimmed.indexOf(";", pos);
        if (attrEnd === -1)
            attrEnd = len;
        const attr = trimmed.slice(pos, attrEnd);
        pos = attrEnd + 1;
        const eqI = attr.indexOf("=");
        const rawKey = (eqI === -1 ? attr : attr.slice(0, eqI)).trim().toLowerCase();
        const val = eqI === -1 ? null : attr.slice(eqI + 1).trim();
        switch (rawKey) {
            case "expires":
                if (val) {
                    const d = new Date(val);
                    if (!Number.isNaN(d.getTime()))
                        cookie.expires = d;
                }
                break;
            case "max-age":
                if (val) {
                    const n = parseInt(val, 10);
                    if (!Number.isNaN(n))
                        cookie.maxAge = n;
                }
                break;
            case "domain":
                if (val)
                    cookie.domain = val.toLowerCase().replace(/^\./, "");
                break;
            case "path":
                if (val)
                    cookie.path = val;
                break;
            case "secure":
                cookie.secure = true;
                break;
            case "httponly":
                cookie.httpOnly = true;
                break;
            case "samesite":
                if (val)
                    cookie.sameSite = val;
                break;
            case "partitioned":
                cookie.partitioned = true;
                break;
        }
    }
    return cookie;
}
export function splitCookiesString(cookiesString) {
    if (Array.isArray(cookiesString))
        return cookiesString;
    if (typeof cookiesString !== "string")
        return [];
    const result = [];
    let pos = 0;
    const len = cookiesString.length;
    while (pos < len) {
        let start = pos;
        let lastComma = -1;
        let cookieSeparatorFound = false;
        while (pos < len) {
            while (pos < len && cookiesString.charCodeAt(pos) <= 0x20)
                pos++;
            if (pos >= len)
                break;
            if (cookiesString.charCodeAt(pos) === 0x2c) {
                lastComma = pos++;
                while (pos < len && cookiesString.charCodeAt(pos) <= 0x20)
                    pos++;
                const nextStart = pos;
                while (pos < len) {
                    const c = cookiesString.charCodeAt(pos);
                    if (c === 0x3d || c === 0x3b || c === 0x2c)
                        break;
                    pos++;
                }
                if (pos < len && cookiesString.charCodeAt(pos) === 0x3d) {
                    cookieSeparatorFound = true;
                    pos = nextStart;
                    result.push(cookiesString.substring(start, lastComma));
                    start = pos;
                }
                else {
                    pos = lastComma + 1;
                }
            }
            else {
                pos++;
            }
        }
        if (!cookieSeparatorFound || pos >= len) {
            result.push(cookiesString.substring(start));
        }
    }
    return result.filter(isNonEmptyString);
}
export function extractSetCookieHeaders(headers) {
    if (typeof headers.getSetCookie === "function") {
        return headers.getSetCookie();
    }
    const raw = headers.get("set-cookie");
    return raw ? splitCookiesString(raw) : [];
}
//# sourceMappingURL=parser.js.map