/*!
 * @sptzx/request
 *
 * Copyright (c) Ky contributors — MIT License
 *   Sindre Sorhus <https://github.com/sindresorhus/ky>
 *
 * Copyright (c) set-cookie-parser contributors — MIT License
 *   Nathaniel Friedman <https://github.com/nfriedly/set-cookie-parser>
 *
 * Copyright (c) 2015-2020, Salesforce.com, Inc. — BSD-3-Clause License
 *   tough-cookie <https://github.com/salesforce/tough-cookie>
 *   Redistribution and use in source and binary forms, with or without
 *   modification, are permitted provided that the following conditions are met:
 *   1. Redistributions of source code must retain the above copyright notice,
 *      this list of conditions and the following disclaimer.
 *   2. Redistributions in binary form must reproduce the above copyright notice,
 *      this list of conditions and the following disclaimer in the documentation
 *      and/or other materials provided with the distribution.
 *   3. Neither the name of Salesforce.com nor the names of its contributors may
 *      be used to endorse or promote products derived from this software without
 *      specific prior written permission.
 *   THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 *   AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 *   IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 *   ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 *   LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 *   CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 *   SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 *   INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 *   CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 *   ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 *   POSSIBILITY OF SUCH DAMAGE.
 */
import { FetchEngine } from "./core/FetchEngine.js";
import { requestMethods, stop, retry } from "./core/constants.js";
import { validateAndMerge } from "./utils/merge.js";
const createInstance = (defaults) => {
    const instance = (input, options) => FetchEngine.create(input, validateAndMerge(defaults, options));
    for (const method of requestMethods) {
        instance[method] = (input, options) => FetchEngine.create(input, validateAndMerge(defaults, options, { method }));
    }
    instance.create = (newDefaults) => createInstance(validateAndMerge(newDefaults));
    instance.extend = (newDefaults) => {
        if (typeof newDefaults === "function")
            newDefaults = newDefaults(defaults ?? {});
        return createInstance(validateAndMerge(defaults, newDefaults));
    };
    instance.stop = stop;
    instance.retry = retry;
    return instance;
};
const request = createInstance();
export default request;
export { CookieJar } from "./cookie/jar.js";
export { CookieStore } from "./cookie/store.js";
export { parseSetCookieString, splitCookiesString, extractSetCookieHeaders } from "./cookie/parser.js";
export { canonicalDomain, domainMatch, permuteDomain } from "./cookie/domain.js";
export { pathMatch, defaultCookiePath } from "./cookie/path.js";
export { HTTPError } from "./errors/HTTPError.js";
export { TimeoutError } from "./errors/TimeoutError.js";
export { ForceRetryError } from "./errors/ForceRetryError.js";
export { CircuitBreaker, CircuitBreakerOpenError } from "./core/circuit-breaker.js";
export { isHTTPError, isTimeoutError, isForceRetryError, isCircuitBreakerOpenError, isRequestError } from "./utils/typeGuards.js";
//# sourceMappingURL=index.js.map