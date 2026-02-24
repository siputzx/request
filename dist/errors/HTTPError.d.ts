import type { NormalizedOptions } from "../types/options.js";
export declare class HTTPError<T = unknown> extends Error {
    response: Response & {
        data?: T;
    };
    request: Request;
    options: NormalizedOptions;
    data: T | string | undefined;
    constructor(response: Response, request: Request, options: NormalizedOptions);
}
//# sourceMappingURL=HTTPError.d.ts.map