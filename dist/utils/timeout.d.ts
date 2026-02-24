export type TimeoutOptions = {
    timeout: number;
    fetch: typeof globalThis.fetch;
};
export declare function timeout(request: Request, init: RequestInit, abortController: AbortController | undefined, options: TimeoutOptions): Promise<Response>;
//# sourceMappingURL=timeout.d.ts.map