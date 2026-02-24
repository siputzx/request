/*!
 * @sptzx/request — MIT License
 * Derived from Ky — MIT License © Sindre Sorhus
 */
import { HTTPError } from "../errors/HTTPError.js";
import { TimeoutError } from "../errors/TimeoutError.js";
import { ForceRetryError } from "../errors/ForceRetryError.js";
import { CircuitBreakerOpenError } from "../core/circuit-breaker.js";
export function isHTTPError(error) {
    return error instanceof HTTPError || error?.name === "HTTPError";
}
export function isTimeoutError(error) {
    return error instanceof TimeoutError || error?.name === "TimeoutError";
}
export function isForceRetryError(error) {
    return error instanceof ForceRetryError || error?.name === "ForceRetryError";
}
export function isCircuitBreakerOpenError(error) {
    return error instanceof CircuitBreakerOpenError || error?.name === "CircuitBreakerOpenError";
}
export function isRequestError(error) {
    return isHTTPError(error) || isTimeoutError(error) || isForceRetryError(error) || isCircuitBreakerOpenError(error);
}
//# sourceMappingURL=typeGuards.js.map