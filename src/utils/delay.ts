/*
 * Derived from Ky — MIT License © Sindre Sorhus
 */

export type DelayOptions = {
  signal?: AbortSignal;
};

export async function delay(ms: number, { signal }: DelayOptions = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal) {
      signal.throwIfAborted();
      signal.addEventListener("abort", abortHandler, { once: true });
    }

    function abortHandler() {
      clearTimeout(timeoutId);
      reject(signal!.reason as Error);
    }

    const timeoutId = setTimeout(() => {
      signal?.removeEventListener("abort", abortHandler);
      resolve();
    }, ms);
  });
}
