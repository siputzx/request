import type { ForceRetryOptions } from "../core/constants.js";
export declare class ForceRetryError extends Error {
    name: "ForceRetryError";
    customDelay: number | undefined;
    code: string | undefined;
    customRequest: Request | undefined;
    constructor(options?: ForceRetryOptions);
}
//# sourceMappingURL=ForceRetryError.d.ts.map