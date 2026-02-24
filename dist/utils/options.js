/*
 * Derived from Ky — MIT License © Sindre Sorhus
 */
import { kyOptionKeys, requestOptionsRegistry, vendorSpecificOptions } from "../core/constants.js";
export const findUnknownOptions = (request, options) => {
    const unknownOptions = {};
    for (const key in options) {
        if (!Object.hasOwn(options, key))
            continue;
        if (!(key in requestOptionsRegistry) &&
            !(key in kyOptionKeys) &&
            (!(key in request) || key in vendorSpecificOptions)) {
            unknownOptions[key] = options[key];
        }
    }
    return unknownOptions;
};
export const hasSearchParameters = (search) => {
    if (search === undefined)
        return false;
    if (Array.isArray(search))
        return search.length > 0;
    if (search instanceof URLSearchParams)
        return search.size > 0;
    if (typeof search === "object")
        return Object.keys(search).length > 0;
    if (typeof search === "string")
        return search.trim().length > 0;
    return Boolean(search);
};
//# sourceMappingURL=options.js.map