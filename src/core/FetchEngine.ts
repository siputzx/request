/*!
 * @sptzx/request — MIT License
 * Derived from Ky — MIT License © Sindre Sorhus
 */

import { HTTPError } from "../errors/HTTPError.js";
import { NonError } from "../errors/NonError.js";
import { ForceRetryError } from "../errors/ForceRetryError.js";
import { TimeoutError } from "../errors/TimeoutError.js";
import { CircuitBreakerOpenError } from "./circuit-breaker.js";
import type { Input, InternalOptions, NormalizedOptions, Options, SearchParamsOption } from "../types/options.js";
import type { ResponsePromise } from "../types/ResponsePromise.js";
import { streamRequest, streamResponse, streamNdjson } from "../utils/body.js";
import { mergeHeaders, mergeHooks } from "../utils/merge.js";
import { normalizeRequestMethod, normalizeRetryOptions } from "../utils/normalize.js";
import { timeout as fetchWithTimeout, type TimeoutOptions } from "../utils/timeout.js";
import { delay } from "../utils/delay.js";
import { findUnknownOptions, hasSearchParameters } from "../utils/options.js";
import { isHTTPError, isTimeoutError } from "../utils/typeGuards.js";
import {
  maxSafeTimeout,
  responseTypeEntries,
  stop,
  RetryMarker,
  supportsAbortController,
  supportsAbortSignal,
  supportsFormData,
  supportsResponseStreams,
  supportsRequestStreams,
} from "./constants.js";

type SearchParamsInit = string | string[][] | Record<string, string> | URLSearchParams | undefined;

const maxErrorBodySize = 10 * 1024 * 1024;

const textDecoderCache = new Map<string, TextDecoder>();

function getTextDecoder(contentType: string): TextDecoder {
  const match = /;\s*charset\s*=\s*(?:"([^"]+)"|([^;,\s]+))/i.exec(contentType);
  const charset = (match?.[1] ?? match?.[2] ?? "").toLowerCase();

  if (!charset || charset === "utf-8" || charset === "utf8") {
    return new TextDecoder();
  }

  let cached = textDecoderCache.get(charset);
  if (!cached) {
    try { cached = new TextDecoder(charset); } catch { cached = new TextDecoder(); }
    if (textDecoderCache.size < 32) textDecoderCache.set(charset, cached);
  }
  return cached;
}

function resolveProxyInit(options: InternalOptions): Record<string, unknown> {
  const extra: Record<string, unknown> = {};
  if (options.dispatcher !== undefined) extra["dispatcher"] = options.dispatcher;
  else if (options.proxyUrl) extra["proxy"] = options.proxyUrl;
  return extra;
}

export class FetchEngine {
  static create(input: Input, options: Options): ResponsePromise {
    const engine = new FetchEngine(input, options);

    const run = async (): Promise<Response> => {
      if (typeof engine.#options.timeout === "number" && engine.#options.timeout > maxSafeTimeout) {
        throw new RangeError(`The \`timeout\` option cannot be greater than ${maxSafeTimeout}`);
      }

      if (engine.#startTime === undefined && typeof engine.#options.timeout === "number") {
        engine.#startTime = Date.now();
      }

      const cb = engine.#options.circuitBreaker;
      if (cb && !cb.canRequest()) {
        throw new CircuitBreakerOpenError(engine.request.url);
      }

      await Promise.resolve();

      let response: Response;
      try {
        response = await engine.#fetch();
      } catch (err) {
        cb?.onFailure();
        throw err;
      }

      if (engine.#options.cookieJar && [301, 302, 303, 307, 308].includes(response.status)) {
        response = await engine.#followRedirectsManually(response);
      }

      for (const hook of engine.#options.hooks.afterResponse) {
        const cloned = engine.#decorateResponse(response.clone());
        let modified;
        try {
          modified = await hook({
            request: engine.request,
            options: engine.#getNormalizedOptions(),
            response: cloned,
            retryCount: engine.#retryCount,
          });
        } catch (error) {
          engine.#cancelResponseBody(cloned);
          engine.#cancelResponseBody(response);
          cb?.onFailure();
          throw error;
        }

        if (modified instanceof RetryMarker) {
          engine.#cancelResponseBody(cloned);
          engine.#cancelResponseBody(response);
          cb?.onFailure();
          throw new ForceRetryError(modified.options);
        }

        const next = modified instanceof globalThis.Response ? modified : response;
        if (cloned !== next) engine.#cancelResponseBody(cloned);
        if (response !== next) engine.#cancelResponseBody(response);
        response = next;
      }

      engine.#decorateResponse(response);

      if (
        !response.ok &&
        (typeof engine.#options.throwHttpErrors === "function"
          ? engine.#options.throwHttpErrors(response.status)
          : engine.#options.throwHttpErrors)
      ) {
        let error = new HTTPError(response, engine.request, engine.#getNormalizedOptions());
        error.data = await engine.#getResponseData(response);

        for (const hook of engine.#options.hooks.beforeError) {
          error = await hook({ error, retryCount: engine.#retryCount });
        }

        cb?.onFailure();
        throw error;
      }

      if (engine.#options.onDownloadProgress) {
        if (typeof engine.#options.onDownloadProgress !== "function") {
          throw new TypeError("The `onDownloadProgress` option must be a function");
        }
        if (!supportsResponseStreams) throw new Error("Streams are not supported in your environment.");
        const progressResponse = response.clone();
        engine.#cancelResponseBody(response);
        cb?.onSuccess();
        return streamResponse(progressResponse, engine.#options.onDownloadProgress);
      }

      if (engine.#options.cookieJar) {
        engine.#options.cookieJar.setCookiesFromResponse(response, engine.request.url);
      }

      cb?.onSuccess();
      return response;
    };

    const result = engine
      .#retry(run)
      .finally(() => {
        engine.#cancelBody(engine.#originalRequest?.body ?? undefined);
        engine.#cancelBody(engine.request.body ?? undefined);
      }) as ResponsePromise;

    for (let i = 0; i < responseTypeEntries.length; i++) {
      const [type, mimeType] = responseTypeEntries[i]!;

      if (
        type === "bytes" &&
        typeof (globalThis.Response?.prototype as unknown as { bytes?: unknown })?.bytes !== "function"
      ) continue;

      (result as unknown as Record<string, () => Promise<unknown>>)[type] = async () => {
        engine.request.headers.set("accept", engine.request.headers.get("accept") ?? mimeType);
        const resp = await result;

        if (type === "json") {
          if (resp.status === 204) return undefined;
          const text = await resp.text();
          if (text === "") return undefined;
          if (options.parseJson) return options.parseJson(text);
          return JSON.parse(text);
        }

        return (resp as unknown as Record<string, () => Promise<unknown>>)[type]?.();
      };
    }

    result.ndjson = async function* <T = unknown>(): AsyncGenerator<T, void, undefined> {
      engine.request.headers.set("accept", engine.request.headers.get("accept") ?? "application/x-ndjson");
      const resp = await result;
      yield* streamNdjson<T>(resp);
    };

    result.stream = (): ReadableStream<Uint8Array> | null => {
      let settled = false;
      let cachedBody: ReadableStream<Uint8Array> | null = null;
      void result.then((resp) => {
        if (!settled) { cachedBody = resp.body; settled = true; }
      });
      if (settled) return cachedBody;
      return null;
    };

    return result;
  }

  static #normalizeSearchParams(searchParams: SearchParamsOption): SearchParamsOption {
    if (
      searchParams &&
      typeof searchParams === "object" &&
      !Array.isArray(searchParams) &&
      !(searchParams instanceof URLSearchParams)
    ) {
      return Object.fromEntries(
        Object.entries(searchParams as Record<string, unknown>).filter(([, v]) => v !== undefined)
      ) as Record<string, string>;
    }
    return searchParams;
  }

  public request: Request;
  #abortController?: AbortController;
  #retryCount = 0;
  #input: Input;
  readonly #options: InternalOptions;
  #originalRequest?: Request;
  readonly #userProvidedAbortSignal?: AbortSignal;
  #cachedNormalizedOptions: NormalizedOptions | undefined;
  #startTime?: number;
  readonly #proxyInit: Record<string, unknown>;

  constructor(input: Input, options: Options = {}) {
    this.#input = input;

    this.#options = {
      ...options,
      headers: mergeHeaders(
        (this.#input as Request).headers as NonNullable<RequestInit["headers"]>,
        options.headers
      ),
      hooks: mergeHooks(
        { beforeRequest: [], beforeRetry: [], beforeError: [], afterResponse: [] },
        options.hooks
      ),
      method: normalizeRequestMethod(options.method ?? (this.#input as Request).method ?? "GET"),
      prefixUrl: String(options.prefixUrl || ""),
      retry: normalizeRetryOptions(options.retry),
      throwHttpErrors: options.throwHttpErrors ?? true,
      timeout: options.timeout ?? 10_000,
      fetch: options.fetch ?? globalThis.fetch.bind(globalThis),
      context: options.context ?? {},
    } as InternalOptions;

    if (
      typeof this.#input !== "string" &&
      !(this.#input instanceof URL || this.#input instanceof globalThis.Request)
    ) {
      throw new TypeError("`input` must be a string, URL, or Request");
    }

    if (this.#options.prefixUrl && typeof this.#input === "string") {
      if (this.#input.startsWith("/")) throw new Error("`input` must not begin with a slash when using `prefixUrl`");
      if (!this.#options.prefixUrl.endsWith("/")) this.#options.prefixUrl += "/";
      this.#input = this.#options.prefixUrl + this.#input;
    }

    if (supportsAbortController && supportsAbortSignal) {
      this.#userProvidedAbortSignal =
        this.#options.signal ?? (this.#input as Request).signal ?? undefined;
      this.#abortController = new globalThis.AbortController();
      this.#options.signal = this.#userProvidedAbortSignal
        ? AbortSignal.any([this.#userProvidedAbortSignal, this.#abortController.signal])
        : this.#abortController.signal;
    }

    if (supportsRequestStreams) {
      (this.#options as Record<string, unknown>)["duplex"] = "half";
    }

    if (this.#options.json !== undefined) {
      this.#options.body = this.#options.stringifyJson?.(this.#options.json) ?? JSON.stringify(this.#options.json);
      this.#options.headers.set(
        "content-type",
        this.#options.headers.get("content-type") ?? "application/json"
      );
    }

    const userProvidedContentType =
      options.headers &&
      new globalThis.Headers(options.headers as HeadersInit).has("content-type");

    if (
      this.#input instanceof globalThis.Request &&
      ((supportsFormData && this.#options.body instanceof globalThis.FormData) ||
        this.#options.body instanceof URLSearchParams) &&
      !userProvidedContentType
    ) {
      this.#options.headers.delete("content-type");
    }

    if (this.#options.cookieJar) {
      const cookieHeader = this.#options.cookieJar.getCookieHeaderForRequest(
        typeof this.#input === "string" ? this.#input : (this.#input as URL | Request).toString()
      );
      if (cookieHeader) this.#options.headers.set("cookie", cookieHeader);
    }

    this.#proxyInit = resolveProxyInit(this.#options);

    this.request = new globalThis.Request(this.#input as string | URL | Request, this.#options as RequestInit);

    if (hasSearchParameters(this.#options.searchParams)) {
      const textParams =
        typeof this.#options.searchParams === "string"
          ? this.#options.searchParams.replace(/^\?/, "")
          : new URLSearchParams(
              FetchEngine.#normalizeSearchParams(this.#options.searchParams) as SearchParamsInit
            ).toString();
      const url = this.request.url.replace(/(?:\?.*?)?(?=#|$)/, "?" + textParams);
      this.request = new globalThis.Request(url, this.#options as RequestInit);
    }

    if (this.#options.onUploadProgress) {
      if (typeof this.#options.onUploadProgress !== "function") {
        throw new TypeError("The `onUploadProgress` option must be a function");
      }
      if (!supportsRequestStreams) throw new Error("Request streams are not supported in your environment.");
      this.request = this.#wrapRequestWithUploadProgress(this.request, this.#options.body ?? undefined);
    }
  }

  #calculateDelay(): number {
    const retryDelay = this.#options.retry.delay(this.#retryCount);

    let jittered = retryDelay;
    const { jitter } = this.#options.retry;

    if (jitter === true) {
      jittered = Math.random() * retryDelay;
    } else if (typeof jitter === "function") {
      jittered = jitter(retryDelay);
      if (!Number.isFinite(jittered) || jittered < 0) jittered = retryDelay;
    }

    const limit = this.#options.retry.backoffLimit ?? Number.POSITIVE_INFINITY;
    return Math.min(limit, jittered);
  }

  #clampToMaxRetryAfter(ms: number): number {
    const max = this.#options.retry.maxRetryAfter;
    return max === undefined ? ms : Math.min(max, ms);
  }

  async #calculateRetryDelay(error: unknown): Promise<number> {
    this.#retryCount++;

    if (this.#retryCount > this.#options.retry.limit) throw error;

    const errorObj = error instanceof Error ? error : new NonError(error);

    if (errorObj instanceof ForceRetryError) return errorObj.customDelay ?? this.#calculateDelay();

    if (!this.#options.retry.methods.includes(this.request.method.toLowerCase())) throw error;

    if (this.#options.retry.shouldRetry !== undefined) {
      const result = await this.#options.retry.shouldRetry({ error: errorObj, retryCount: this.#retryCount });
      if (result === false) throw error;
      if (result === true) return this.#calculateDelay();
    }

    if (isTimeoutError(error) && !this.#options.retry.retryOnTimeout) throw error;

    if (isHTTPError(error)) {
      if (!this.#options.retry.statusCodes.includes(error.response.status)) throw error;

      const retryAfterHeader =
        error.response.headers.get("Retry-After") ??
        error.response.headers.get("RateLimit-Reset") ??
        error.response.headers.get("X-RateLimit-Reset");

      if (retryAfterHeader && this.#options.retry.afterStatusCodes.includes(error.response.status)) {
        let after = Number(retryAfterHeader) * 1000;
        if (Number.isNaN(after)) {
          after = Date.parse(retryAfterHeader) - Date.now();
        } else if (after >= Date.parse("2024-01-01")) {
          after -= Date.now();
        }
        if (!Number.isFinite(after)) return this.#clampToMaxRetryAfter(this.#calculateDelay());
        return this.#clampToMaxRetryAfter(Math.max(0, after));
      }

      if (error.response.status === 413) throw error;
    }

    return this.#calculateDelay();
  }

  #decorateResponse(response: Response): Response {
    if (this.#options.parseJson) {
      response.json = async () => this.#options.parseJson!(await response.text());
    }
    return response;
  }

  async #getResponseData(response: Response): Promise<unknown> {
    const errorTimeout = this.#options.timeout === false ? 10_000 : this.#options.timeout;
    const text = await this.#readResponseText(response, errorTimeout);
    if (!text) return undefined;

    const contentType = response.headers.get("content-type") ?? "";
    const mimeType = (contentType.split(";", 1)[0] ?? "").trim().toLowerCase();
    if (!/\/(?:.*[.+-])?json$/.test(mimeType)) return text;

    try { return (this.#options.parseJson ?? JSON.parse)(text); } catch { return undefined; }
  }

  async #readResponseText(response: Response, timeoutMs: number): Promise<string | undefined> {
    const { body } = response;

    if (!body) {
      try { return await response.text(); } catch { return undefined; }
    }

    let reader: ReadableStreamDefaultReader<Uint8Array>;
    try { reader = body.getReader(); } catch { return undefined; }

    const decoder = getTextDecoder(response.headers.get("content-type") ?? "");
    const chunks: string[] = [];
    let totalBytes = 0;

    const readAll = (async (): Promise<string | undefined> => {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          totalBytes += value.byteLength;
          if (totalBytes > maxErrorBodySize) {
            void reader.cancel().catch(() => undefined);
            return undefined;
          }
          chunks.push(decoder.decode(value, { stream: true }));
        }
      } catch { return undefined; }
      chunks.push(decoder.decode());
      return chunks.join("");
    })();

    const raceTimeout = new Promise<undefined>((resolve) => {
      const tid = setTimeout(() => resolve(undefined), timeoutMs);
      void readAll.finally(() => clearTimeout(tid));
    });

    const result = await Promise.race([readAll, raceTimeout]);
    if (result === undefined) void reader.cancel().catch(() => undefined);
    return result;
  }

  #cancelBody(body: ReadableStream | undefined): void {
    if (!body) return;
    void body.cancel().catch(() => undefined);
  }

  #cancelResponseBody(response: Response): void {
    this.#cancelBody(response.body ?? undefined);
  }

  async #retry<T extends () => Promise<unknown>>(fn: T): Promise<Awaited<ReturnType<T>> | Response | void> {
    try {
      return await fn() as Awaited<ReturnType<T>>;
    } catch (error) {
      const retryDelay = Math.min(await this.#calculateRetryDelay(error), maxSafeTimeout);
      const delayOpts = this.#userProvidedAbortSignal ? { signal: this.#userProvidedAbortSignal } : {};

      let delayMs = retryDelay;
      const remaining = this.#getRemainingTimeout();

      if (remaining !== undefined) {
        if (remaining <= 0) throw new TimeoutError(this.request);
        if (delayMs >= remaining) {
          await delay(remaining, delayOpts);
          throw new TimeoutError(this.request);
        }
        delayMs = Math.min(delayMs, remaining);
      }

      await delay(delayMs, delayOpts);

      const remainingAfterDelay = this.#getRemainingTimeout();
      if (remainingAfterDelay !== undefined && remainingAfterDelay <= 0) throw new TimeoutError(this.request);

      if (error instanceof ForceRetryError && error.customRequest) {
        const managed = this.#options.signal
          ? new globalThis.Request(error.customRequest, { signal: this.#options.signal })
          : new globalThis.Request(error.customRequest);
        this.#assignRequest(managed);
      }

      for (const hook of this.#options.hooks.beforeRetry) {
        const hookResult = await hook({
          request: this.request,
          options: this.#getNormalizedOptions(),
          error: error as Error,
          retryCount: this.#retryCount,
        });

        if (hookResult instanceof globalThis.Request) { this.#assignRequest(hookResult); break; }
        if (hookResult instanceof globalThis.Response) return hookResult;
        if (hookResult === stop) return;
      }

      const remainingAfterHooks = this.#getRemainingTimeout();
      if (remainingAfterHooks !== undefined && remainingAfterHooks <= 0) throw new TimeoutError(this.request);

      return this.#retry(fn);
    }
  }

  async #fetch(): Promise<Response> {
    if (this.#abortController?.signal.aborted) {
      this.#abortController = new globalThis.AbortController();
      this.#options.signal = this.#userProvidedAbortSignal
        ? AbortSignal.any([this.#userProvidedAbortSignal, this.#abortController.signal])
        : this.#abortController.signal;
      this.request = new globalThis.Request(this.request, { signal: this.#options.signal });
    }

    for (const hook of this.#options.hooks.beforeRequest) {
      const result = await hook({
        request: this.request,
        options: this.#getNormalizedOptions(),
        retryCount: this.#retryCount,
      });
      if (result instanceof Response) return result;
      if (result instanceof globalThis.Request) { this.#assignRequest(result); break; }
    }

    const extraOptions = {
      ...findUnknownOptions(this.request, this.#options as unknown as Record<string, unknown>),
      ...this.#proxyInit,
    };

    if (this.#options.cookieJar) {
      (extraOptions as Record<string, unknown>)["redirect"] = "manual";
    }

    this.#originalRequest = this.request;
    this.request = this.#originalRequest.clone();

    if (this.#options.timeout === false) {
      return this.#options.fetch(this.#originalRequest, extraOptions);
    }

    const remaining = this.#getRemainingTimeout() ?? (this.#options.timeout as number);
    if (remaining <= 0) throw new TimeoutError(this.request);

    return fetchWithTimeout(this.#originalRequest, extraOptions, this.#abortController, {
      ...this.#options,
      timeout: remaining,
    } as TimeoutOptions);
  }

  async #followRedirectsManually(response: Response): Promise<Response> {
    const maxRedirects = this.#options.maxRedirects ?? 10;
    let hops = 0;
    let currentResponse = response;
    let currentUrl = response.url || (this.#originalRequest ?? this.request).url;
    let currentMethod = this.request.method;

    while ([301, 302, 303, 307, 308].includes(currentResponse.status)) {
      if (hops >= maxRedirects) {
        throw new Error(`Maximum redirects (${maxRedirects}) exceeded`);
      }

      const location = currentResponse.headers.get("location");
      if (!location) break;

      void currentResponse.body?.cancel().catch(() => undefined);

      this.#options.cookieJar!.setCookiesFromResponse(currentResponse, currentUrl);

      const nextUrl = new URL(location, currentUrl).href;
      const status = currentResponse.status;

      let nextMethod = currentMethod;
      let nextBody: BodyInit | null | undefined = undefined;

      if (status === 303 || ((status === 301 || status === 302) && currentMethod === "POST")) {
        nextMethod = "GET";
      } else if (status === 307 || status === 308) {
        nextBody = this.#options.body ?? undefined;
      }

      const cookieHeader = this.#options.cookieJar!.getCookieHeaderForRequest(nextUrl);
      const nextHeaders = new Headers(this.#options.headers);
      if (cookieHeader) nextHeaders.set("cookie", cookieHeader);
      else nextHeaders.delete("cookie");

      const nextRequest = new globalThis.Request(nextUrl, {
        method: nextMethod,
        headers: nextHeaders,
        body: nextBody ?? null,
        signal: this.#options.signal,
        credentials: (this.#options as RequestInit).credentials,
        cache: (this.#options as RequestInit).cache,
        referrerPolicy: (this.#options as RequestInit).referrerPolicy,
        redirect: "manual",
      });

      const extraOptions = { ...this.#proxyInit };

      currentResponse = this.#options.timeout === false
        ? await this.#options.fetch(nextRequest, extraOptions)
        : await fetchWithTimeout(nextRequest, extraOptions, this.#abortController, {
            ...this.#options,
            timeout: this.#getRemainingTimeout() ?? (this.#options.timeout as number),
          } as TimeoutOptions);

      currentUrl = currentResponse.url || nextUrl;
      currentMethod = nextMethod;
      hops++;
    }

    return currentResponse;
  }

  #getRemainingTimeout(): number | undefined {
    if (this.#options.timeout === false) return undefined;
    if (this.#startTime === undefined) return this.#options.timeout as number;
    return Math.max(0, (this.#options.timeout as number) - (Date.now() - this.#startTime));
  }

  #getNormalizedOptions(): NormalizedOptions {
    if (!this.#cachedNormalizedOptions) {
      const { hooks: _h, json: _j, parseJson: _p, stringifyJson: _s, searchParams: _sp, timeout: _t, throwHttpErrors: _th, fetch: _f, ...rest } = this.#options;
      this.#cachedNormalizedOptions = Object.freeze(rest) as NormalizedOptions;
    }
    return this.#cachedNormalizedOptions;
  }

  #assignRequest(request: Request): void {
    this.#cachedNormalizedOptions = undefined;
    this.request = this.#wrapRequestWithUploadProgress(request);
  }

  #wrapRequestWithUploadProgress(request: Request, originalBody?: BodyInit): Request {
    if (!this.#options.onUploadProgress || !request.body) return request;
    return streamRequest(request, this.#options.onUploadProgress, originalBody ?? this.#options.body ?? undefined);
  }
}
