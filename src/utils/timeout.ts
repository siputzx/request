/*
 * Derived from Ky — MIT License © Sindre Sorhus
 */

import { TimeoutError } from "../errors/TimeoutError.js";

export type TimeoutOptions = {
  timeout: number;
  fetch: typeof globalThis.fetch;
};

export async function timeout(
  request: Request,
  init: RequestInit,
  abortController: AbortController | undefined,
  options: TimeoutOptions
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      if (abortController) {
        abortController.abort();
      }
      reject(new TimeoutError(request));
    }, options.timeout);

    void options
      .fetch(request, init)
      .then(resolve)
      .catch(reject)
      .then(() => {
        clearTimeout(timeoutId);
      });
  });
}
