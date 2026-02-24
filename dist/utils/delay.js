/*
 * Derived from Ky — MIT License © Sindre Sorhus
 */
export async function delay(ms, { signal } = {}) {
    return new Promise((resolve, reject) => {
        if (signal) {
            signal.throwIfAborted();
            signal.addEventListener("abort", abortHandler, { once: true });
        }
        function abortHandler() {
            clearTimeout(timeoutId);
            reject(signal.reason);
        }
        const timeoutId = setTimeout(() => {
            signal?.removeEventListener("abort", abortHandler);
            resolve();
        }, ms);
    });
}
//# sourceMappingURL=delay.js.map