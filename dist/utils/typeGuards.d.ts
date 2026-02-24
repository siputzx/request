/*!
 * @sptzx/request — MIT License
 * Derived from Ky — MIT License © Sindre Sorhus
 */
import { HTTPError } from "../errors/HTTPError.js";
import { TimeoutError } from "../errors/TimeoutError.js";
import { ForceRetryError } from "../errors/ForceRetryError.js";
import { CircuitBreakerOpenError } from "../core/circuit-breaker.js";
export declare function isHTTPError<T = unknown>(error: unknown): error is HTTPError<T>;
export declare function isTimeoutError(error: unknown): error is TimeoutError;
export declare function isForceRetryError(error: unknown): error is ForceRetryError;
export declare function isCircuitBreakerOpenError(error: unknown): error is CircuitBreakerOpenError;
export declare function isRequestError(error: unknown): error is HTTPError | TimeoutError | ForceRetryError | CircuitBreakerOpenError;
//# sourceMappingURL=typeGuards.d.ts.map