/*!
 * @sptzx/request — MIT License
 * Derived from Ky — MIT License © Sindre Sorhus
 */
import type { KyOptionsRegistry, RequestHttpMethod } from "../types/options.js";
export declare const supportsRequestStreams: boolean;
export declare const supportsAbortController: boolean;
export declare const supportsAbortSignal: boolean;
export declare const supportsResponseStreams: boolean;
export declare const supportsFormData: boolean;
export declare const requestMethods: readonly ["get", "post", "put", "patch", "head", "delete"];
export declare const responseTypes: {
    readonly json: "application/json";
    readonly text: "text/*";
    readonly formData: "multipart/form-data";
    readonly arrayBuffer: "*/*";
    readonly blob: "*/*";
    readonly bytes: "*/*";
};
export declare const responseTypeEntries: [keyof typeof responseTypes, string][];
export declare const maxSafeTimeout = 2147483647;
export declare const usualFormBoundarySize: number;
export declare const stop: unique symbol;
export type ForceRetryOptions = {
    delay?: number;
    code?: string;
    cause?: Error;
    request?: Request;
};
export declare class RetryMarker {
    options: ForceRetryOptions | undefined;
    constructor(options?: ForceRetryOptions);
}
export declare const retry: (options?: ForceRetryOptions) => RetryMarker;
export declare const kyOptionKeys: KyOptionsRegistry;
export declare const vendorSpecificOptions: Record<string, true>;
export declare const requestOptionsRegistry: Record<string, true>;
export declare const retryMethods: RequestHttpMethod[];
export declare const retryStatusCodes: number[];
export declare const retryAfterStatusCodes: number[];
//# sourceMappingURL=constants.d.ts.map