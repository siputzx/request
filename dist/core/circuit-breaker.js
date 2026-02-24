/*!
 * @sptzx/request — MIT License
 */
"use strict";
export class CircuitBreakerOpenError extends Error {
    name = "CircuitBreakerOpenError";
    constructor(url) {
        super(`Circuit breaker OPEN: requests to ${url} are suspended`);
    }
}
export class CircuitBreaker {
    #threshold;
    #halfOpenAfterMs;
    #successThreshold;
    #onStateChange;
    #state = "CLOSED";
    #failures = 0;
    #successes = 0;
    #openedAt = 0;
    constructor(opts = {}) {
        this.#threshold = opts.threshold ?? 5;
        this.#halfOpenAfterMs = opts.halfOpenAfterMs ?? 30_000;
        this.#successThreshold = opts.successThreshold ?? 1;
        this.#onStateChange = opts.onStateChange;
    }
    get state() {
        return this.#state;
    }
    canRequest() {
        if (this.#state === "CLOSED")
            return true;
        if (this.#state === "OPEN") {
            if (Date.now() - this.#openedAt >= this.#halfOpenAfterMs) {
                this.#transition("HALF_OPEN");
                return true;
            }
            return false;
        }
        return true;
    }
    onSuccess() {
        if (this.#state === "HALF_OPEN") {
            if (++this.#successes >= this.#successThreshold) {
                this.#failures = 0;
                this.#successes = 0;
                this.#transition("CLOSED");
            }
        }
        else {
            this.#failures = 0;
        }
    }
    onFailure() {
        this.#successes = 0;
        if (++this.#failures >= this.#threshold) {
            this.#openedAt = Date.now();
            this.#transition("OPEN");
        }
    }
    reset() {
        this.#failures = 0;
        this.#successes = 0;
        this.#openedAt = 0;
        if (this.#state !== "CLOSED")
            this.#transition("CLOSED");
    }
    #transition(next) {
        const prev = this.#state;
        this.#state = next;
        this.#onStateChange?.(prev, next);
    }
}
//# sourceMappingURL=circuit-breaker.js.map