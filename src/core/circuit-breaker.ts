/*!
 * @sptzx/request — MIT License
 */

"use strict";

export type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  threshold?: number;
  halfOpenAfterMs?: number;
  successThreshold?: number;
  onStateChange?: (prev: CircuitBreakerState, next: CircuitBreakerState) => void;
}

export class CircuitBreakerOpenError extends Error {
  override name = "CircuitBreakerOpenError" as const;
  constructor(url: string) {
    super(`Circuit breaker OPEN: requests to ${url} are suspended`);
  }
}

export class CircuitBreaker {
  readonly #threshold: number;
  readonly #halfOpenAfterMs: number;
  readonly #successThreshold: number;
  readonly #onStateChange?: CircuitBreakerOptions["onStateChange"];

  #state: CircuitBreakerState = "CLOSED";
  #failures = 0;
  #successes = 0;
  #openedAt = 0;

  constructor(opts: CircuitBreakerOptions = {}) {
    this.#threshold = opts.threshold ?? 5;
    this.#halfOpenAfterMs = opts.halfOpenAfterMs ?? 30_000;
    this.#successThreshold = opts.successThreshold ?? 1;
    this.#onStateChange = opts.onStateChange;
  }

  get state(): CircuitBreakerState {
    return this.#state;
  }

  canRequest(): boolean {
    if (this.#state === "CLOSED") return true;
    if (this.#state === "OPEN") {
      if (Date.now() - this.#openedAt >= this.#halfOpenAfterMs) {
        this.#transition("HALF_OPEN");
        return true;
      }
      return false;
    }
    return true;
  }

  onSuccess(): void {
    if (this.#state === "HALF_OPEN") {
      if (++this.#successes >= this.#successThreshold) {
        this.#failures = 0;
        this.#successes = 0;
        this.#transition("CLOSED");
      }
    } else {
      this.#failures = 0;
    }
  }

  onFailure(): void {
    this.#successes = 0;
    if (++this.#failures >= this.#threshold) {
      this.#openedAt = Date.now();
      this.#transition("OPEN");
    }
  }

  reset(): void {
    this.#failures = 0;
    this.#successes = 0;
    this.#openedAt = 0;
    if (this.#state !== "CLOSED") this.#transition("CLOSED");
  }

  #transition(next: CircuitBreakerState): void {
    const prev = this.#state;
    this.#state = next;
    this.#onStateChange?.(prev, next);
  }
}
