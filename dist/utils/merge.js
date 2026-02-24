/*!
 * @sptzx/request — MIT License
 * Derived from Ky — MIT License © Sindre Sorhus
 */
import { supportsAbortSignal } from "../core/constants.js";
import { isObject } from "./is.js";
const CRLF_RE = /[\r\n]/g;
function sanitizeHeaderValue(value) {
    return CRLF_RE.test(value) ? value.replace(CRLF_RE, "") : value;
}
const PROTOTYPE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
export const validateAndMerge = (...sources) => {
    for (const source of sources) {
        if ((!isObject(source) || Array.isArray(source)) && source !== undefined) {
            throw new TypeError("The `options` argument must be an object");
        }
    }
    return deepMerge({}, ...sources);
};
export const mergeHeaders = (source1 = {}, source2 = {}) => {
    const result = new globalThis.Headers(source1);
    const isHeadersInstance = source2 instanceof globalThis.Headers;
    const source = new globalThis.Headers(source2);
    for (const [key, value] of source.entries()) {
        if ((isHeadersInstance && value === "undefined") || value === undefined) {
            result.delete(key);
        }
        else {
            result.set(key, sanitizeHeaderValue(value));
        }
    }
    return result;
};
function newHookValue(original, incoming, property) {
    return Object.hasOwn(incoming, property) && incoming[property] === undefined
        ? []
        : deepMerge((original[property] ?? []), (incoming[property] ?? []));
}
export const mergeHooks = (original = {}, incoming = {}) => ({
    beforeRequest: newHookValue(original, incoming, "beforeRequest"),
    beforeRetry: newHookValue(original, incoming, "beforeRetry"),
    afterResponse: newHookValue(original, incoming, "afterResponse"),
    beforeError: newHookValue(original, incoming, "beforeError"),
});
const appendSearchParameters = (target, source) => {
    const result = new URLSearchParams();
    for (const input of [target, source]) {
        if (input === undefined)
            continue;
        if (input instanceof URLSearchParams) {
            for (const [k, v] of input.entries())
                result.append(k, v);
        }
        else if (Array.isArray(input)) {
            for (const pair of input) {
                if (!Array.isArray(pair) || pair.length !== 2) {
                    throw new TypeError("Array search parameters must be [[key, value], ...] format");
                }
                result.append(String(pair[0]), String(pair[1]));
            }
        }
        else if (isObject(input)) {
            for (const [k, v] of Object.entries(input)) {
                if (v !== undefined)
                    result.append(k, String(v));
            }
        }
        else {
            for (const [k, v] of new URLSearchParams(input).entries())
                result.append(k, v);
        }
    }
    return result;
};
export const deepMerge = (...sources) => {
    let returnValue = Object.create(null);
    let headers = {};
    let hooks = {};
    let searchParameters;
    const signals = [];
    for (const source of sources) {
        if (Array.isArray(source)) {
            returnValue = [...(Array.isArray(returnValue) ? returnValue : []), ...source];
            continue;
        }
        if (!isObject(source))
            continue;
        for (const [key, value] of Object.entries(source)) {
            if (PROTOTYPE_KEYS.has(key))
                continue;
            if (key === "signal" && value instanceof globalThis.AbortSignal) {
                signals.push(value);
                continue;
            }
            if (key === "context") {
                if (value !== undefined && value !== null && (!isObject(value) || Array.isArray(value))) {
                    throw new TypeError("The `context` option must be an object");
                }
                returnValue["context"] = value === undefined || value === null
                    ? {}
                    : { ...returnValue["context"], ...value };
                continue;
            }
            if (key === "searchParams") {
                searchParameters = (value === undefined || value === null)
                    ? undefined
                    : searchParameters === undefined ? value : appendSearchParameters(searchParameters, value);
                continue;
            }
            if (key === "hooks") {
                hooks = mergeHooks(hooks, value);
                returnValue["hooks"] = hooks;
                continue;
            }
            if (key === "headers") {
                headers = mergeHeaders(headers, value);
                returnValue["headers"] = headers;
                continue;
            }
            if (isObject(value) && key in returnValue) {
                returnValue[key] = deepMerge(returnValue[key], value);
            }
            else {
                returnValue[key] = value;
            }
        }
    }
    if (searchParameters !== undefined)
        returnValue["searchParams"] = searchParameters;
    if (signals.length === 1) {
        returnValue["signal"] = signals[0];
    }
    else if (signals.length > 1) {
        returnValue["signal"] = supportsAbortSignal ? AbortSignal.any(signals) : signals.at(-1);
    }
    return returnValue;
};
//# sourceMappingURL=merge.js.map