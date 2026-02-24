/*!
 * @sptzx/request — MIT License
 * Derived from Ky — MIT License © Sindre Sorhus
 */

import { HTTPError } from "../errors/HTTPError.js";
import { TimeoutError } from "../errors/TimeoutError.js";
import { ForceRetryError } from "../errors/ForceRetryError.js";
import { CircuitBreakerOpenError } from "../core/circuit-breaker.js";

export function isHTTPError<T = unknown>(error: unknown): error is HTTPError<T> {
  return error instanceof HTTPError || (error as Error | null)?.name === "HTTPError";
}

export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError || (error as Error | null)?.name === "TimeoutError";
}

export function isForceRetryError(error: unknown): error is ForceRetryError {
  return error instanceof ForceRetryError || (error as Error | null)?.name === "ForceRetryError";
}

export function isCircuitBreakerOpenError(error: unknown): error is CircuitBreakerOpenError {
  return error instanceof CircuitBreakerOpenError || (error as Error | null)?.name === "CircuitBreakerOpenError";
}

export function isRequestError(error: unknown): error is HTTPError | TimeoutError | ForceRetryError | CircuitBreakerOpenError {
  return isHTTPError(error) || isTimeoutError(error) || isForceRetryError(error) || isCircuitBreakerOpenError(error);
}
