/*!
 * @sptzx/request — MIT License
 * Derived from Ky — MIT License © Sindre Sorhus
 */

import { requestMethods, retryMethods, retryStatusCodes, retryAfterStatusCodes } from "../core/constants.js";
import type { InternalRetryOptions } from "../types/options.js";
import type { RetryOptions } from "../types/retry.js";
import type { RequestHttpMethod } from "../types/options.js";

export const normalizeRequestMethod = (input: string): string =>
  (requestMethods as readonly string[]).includes(input.toLowerCase()) ? input.toUpperCase() : input;

const defaultRetryOptions: InternalRetryOptions = {
  limit: 2,
  methods: retryMethods,
  statusCodes: retryStatusCodes,
  afterStatusCodes: retryAfterStatusCodes,
  maxRetryAfter: Number.POSITIVE_INFINITY,
  backoffLimit: Number.POSITIVE_INFINITY,
  delay: (attemptCount) => 0.3 * (2 ** (attemptCount - 1)) * 1000,
  jitter: true,
  retryOnTimeout: false,
};

export const normalizeRetryOptions = (retry: number | RetryOptions = {}): InternalRetryOptions => {
  if (typeof retry === "number") return { ...defaultRetryOptions, limit: retry };

  if (retry.methods && !Array.isArray(retry.methods)) throw new Error("retry.methods must be an array");
  if (retry.statusCodes && !Array.isArray(retry.statusCodes)) throw new Error("retry.statusCodes must be an array");

  const normalizedMethods = retry.methods?.map((m) => m.toLowerCase() as RequestHttpMethod);
  const normalized = Object.fromEntries(Object.entries(retry).filter(([, v]) => v !== undefined)) as RetryOptions;

  return {
    ...defaultRetryOptions,
    ...normalized,
    ...(normalizedMethods ? { methods: normalizedMethods } : {}),
  };
};
