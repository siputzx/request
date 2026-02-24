/*
 * Derived from Ky — MIT License © Sindre Sorhus
 */
import { TimeoutError } from "../errors/TimeoutError.js";
export async function timeout(request, init, abortController, options) {
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
//# sourceMappingURL=timeout.js.map