import type { HttpMethod } from "./options.js";

export type ShouldRetryState = {
  error: Error;
  retryCount: number;
};

export type RetryOptions = {
  limit?: number;
  methods?: HttpMethod[];
  statusCodes?: number[];
  afterStatusCodes?: number[];
  maxRetryAfter?: number;
  backoffLimit?: number;
  delay?: (attemptCount: number) => number;
  jitter?: boolean | ((delay: number) => number) | undefined;
  retryOnTimeout?: boolean;
  shouldRetry?: (state: ShouldRetryState) => boolean | undefined | Promise<boolean | undefined>;
};
