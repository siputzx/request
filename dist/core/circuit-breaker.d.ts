/*!
 * @sptzx/request — MIT License
 */
export type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";
export interface CircuitBreakerOptions {
    threshold?: number;
    halfOpenAfterMs?: number;
    successThreshold?: number;
    onStateChange?: (prev: CircuitBreakerState, next: CircuitBreakerState) => void;
}
export declare class CircuitBreakerOpenError extends Error {
    name: "CircuitBreakerOpenError";
    constructor(url: string);
}
export declare class CircuitBreaker {
    #private;
    constructor(opts?: CircuitBreakerOptions);
    get state(): CircuitBreakerState;
    canRequest(): boolean;
    onSuccess(): void;
    onFailure(): void;
    reset(): void;
}
//# sourceMappingURL=circuit-breaker.d.ts.map