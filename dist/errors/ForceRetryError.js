/*
 * Derived from Ky — MIT License © Sindre Sorhus
 */
import { NonError } from "./NonError.js";
export class ForceRetryError extends Error {
    name = "ForceRetryError";
    customDelay;
    code;
    customRequest;
    constructor(options) {
        const cause = options?.cause
            ? options.cause instanceof Error
                ? options.cause
                : new NonError(options.cause)
            : undefined;
        super(options?.code ? `Forced retry: ${options.code}` : "Forced retry", cause ? { cause } : undefined);
        this.customDelay = options?.delay;
        this.code = options?.code;
        this.customRequest = options?.request;
    }
}
//# sourceMappingURL=ForceRetryError.js.map