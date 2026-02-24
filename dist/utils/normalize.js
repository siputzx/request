/*!
 * @sptzx/request — MIT License
 * Derived from Ky — MIT License © Sindre Sorhus
 */
import { requestMethods, retryMethods, retryStatusCodes, retryAfterStatusCodes } from "../core/constants.js";
export const normalizeRequestMethod = (input) => requestMethods.includes(input.toLowerCase()) ? input.toUpperCase() : input;
const defaultRetryOptions = {
    limit: 2,
    methods: retryMethods,
    statusCodes: retryStatusCodes,
    afterStatusCodes: retryAfterStatusCodes,
    maxRetryAfter: Number.POSITIVE_INFINITY,
    backoffLimit: Number.POSITIVE_INFINITY,
    delay: (attemptCount) => 0.3 * (2 ** (attemptCount - 1)) * 1000,
    jitter: true,
    retryOnTimeout: false,
};
export const normalizeRetryOptions = (retry = {}) => {
    if (typeof retry === "number")
        return { ...defaultRetryOptions, limit: retry };
    if (retry.methods && !Array.isArray(retry.methods))
        throw new Error("retry.methods must be an array");
    if (retry.statusCodes && !Array.isArray(retry.statusCodes))
        throw new Error("retry.statusCodes must be an array");
    const normalizedMethods = retry.methods?.map((m) => m.toLowerCase());
    const normalized = Object.fromEntries(Object.entries(retry).filter(([, v]) => v !== undefined));
    return {
        ...defaultRetryOptions,
        ...normalized,
        ...(normalizedMethods ? { methods: normalizedMethods } : {}),
    };
};
//# sourceMappingURL=normalize.js.map