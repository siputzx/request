/*!
 * @sptzx/request — MIT License
 * Derived from Ky — MIT License © Sindre Sorhus
 */
export const supportsRequestStreams = (() => {
    let duplexAccessed = false;
    let hasContentType = false;
    const supportsReadableStream = typeof globalThis.ReadableStream === "function";
    const supportsRequest = typeof globalThis.Request === "function";
    if (supportsReadableStream && supportsRequest) {
        try {
            hasContentType = new globalThis.Request("https://empty.invalid", {
                body: new globalThis.ReadableStream(),
                method: "POST",
                get duplex() { duplexAccessed = true; return "half"; },
            }).headers.has("Content-Type");
        }
        catch (error) {
            if (error instanceof Error && error.message === "unsupported BodyInit type")
                return false;
            throw error;
        }
    }
    return duplexAccessed && !hasContentType;
})();
export const supportsAbortController = typeof globalThis.AbortController === "function";
export const supportsAbortSignal = typeof globalThis.AbortSignal === "function" &&
    typeof globalThis.AbortSignal.any === "function";
export const supportsResponseStreams = typeof globalThis.ReadableStream === "function";
export const supportsFormData = typeof globalThis.FormData === "function";
export const requestMethods = ["get", "post", "put", "patch", "head", "delete"];
export const responseTypes = {
    json: "application/json",
    text: "text/*",
    formData: "multipart/form-data",
    arrayBuffer: "*/*",
    blob: "*/*",
    bytes: "*/*",
};
export const responseTypeEntries = Object.entries(responseTypes);
export const maxSafeTimeout = 2_147_483_647;
export const usualFormBoundarySize = new TextEncoder().encode("------WebKitFormBoundaryaxpyiPgbbPti10Rw").length;
export const stop = Symbol("stop");
export class RetryMarker {
    options;
    constructor(options) { this.options = options; }
}
export const retry = (options) => new RetryMarker(options);
export const kyOptionKeys = {
    json: true,
    parseJson: true,
    stringifyJson: true,
    searchParams: true,
    prefixUrl: true,
    retry: true,
    timeout: true,
    hooks: true,
    throwHttpErrors: true,
    onDownloadProgress: true,
    onUploadProgress: true,
    fetch: true,
    context: true,
    cookieJar: true,
    circuitBreaker: true,
    proxyUrl: true,
    dispatcher: true,
};
export const vendorSpecificOptions = { next: true };
export const requestOptionsRegistry = {
    method: true, headers: true, body: true, mode: true,
    credentials: true, cache: true, redirect: true, referrer: true,
    referrerPolicy: true, integrity: true, keepalive: true,
    signal: true, window: true, duplex: true,
};
export const retryMethods = ["get", "put", "head", "delete"];
export const retryStatusCodes = [408, 413, 429, 500, 502, 503, 504];
export const retryAfterStatusCodes = [413, 429, 503];
//# sourceMappingURL=constants.js.map