import type { stop, RetryMarker } from "../core/constants.js";
import type { HTTPError } from "../errors/HTTPError.js";
import type { NormalizedOptions } from "./options.js";
export type FetchRequest = Request;
export type FetchResponse<T = unknown> = Response & {
    data?: T;
};
export type BeforeRequestState = {
    request: FetchRequest;
    options: NormalizedOptions;
    retryCount: number;
};
export type BeforeRequestHook = (state: BeforeRequestState) => Request | Response | void | Promise<Request | Response | void>;
export type BeforeRetryState = {
    request: FetchRequest;
    options: NormalizedOptions;
    error: Error;
    retryCount: number;
};
export type BeforeRetryHook = (state: BeforeRetryState) => Request | Response | typeof stop | void | Promise<Request | Response | typeof stop | void>;
export type AfterResponseState = {
    request: FetchRequest;
    options: NormalizedOptions;
    response: FetchResponse;
    retryCount: number;
};
export type AfterResponseHook = (state: AfterResponseState) => Response | RetryMarker | void | Promise<Response | RetryMarker | void>;
export type BeforeErrorState = {
    error: HTTPError;
    retryCount: number;
};
export type BeforeErrorHook = (state: BeforeErrorState) => HTTPError | Promise<HTTPError>;
export type Hooks = {
    beforeRequest?: BeforeRequestHook[];
    beforeRetry?: BeforeRetryHook[];
    afterResponse?: AfterResponseHook[];
    beforeError?: BeforeErrorHook[];
};
//# sourceMappingURL=hooks.d.ts.map