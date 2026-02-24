/*!
 * @sptzx/request — MIT License
 */

import type { LiteralUnion } from "./common.js";
import type { Hooks } from "./hooks.js";
import type { RetryOptions } from "./retry.js";
import type { CookieJar } from "../cookie/jar.js";
import type { CircuitBreaker } from "../core/circuit-breaker.js";

export type SearchParamsInit = string | string[][] | Record<string, string> | URLSearchParams | undefined;
export type SearchParamsOption = SearchParamsInit | Record<string, string | number | boolean | undefined> | Array<Array<string | number | boolean>>;

export type RequestHttpMethod = "get" | "post" | "put" | "patch" | "head" | "delete";
export type HttpMethod = LiteralUnion<RequestHttpMethod | "options" | "trace", string>;

export type Input = string | URL | Request;

export type Progress = {
  percent: number;
  transferredBytes: number;
  totalBytes: number;
};

export type KyHeadersInit = NonNullable<RequestInit["headers"]> | Record<string, string | undefined>;

export type KyOptionsRegistry = Record<string, true>;

export type ProxyOptions = {
  proxyUrl?: string;
  dispatcher?: unknown;
};

export type Options = Omit<RequestInit, "headers"> & ProxyOptions & {
  headers?: KyHeadersInit;
  json?: unknown;
  parseJson?: (text: string) => unknown;
  stringifyJson?: (data: unknown) => string;
  searchParams?: SearchParamsOption;
  prefixUrl?: URL | string;
  retry?: number | RetryOptions;
  timeout?: number | false;
  hooks?: Hooks;
  throwHttpErrors?: boolean | ((statusCode: number) => boolean);
  fetch?: typeof globalThis.fetch;
  onDownloadProgress?: (progress: Progress, chunk: Uint8Array) => void;
  onUploadProgress?: (progress: Progress, chunk: Uint8Array) => void;
  cookieJar?: CookieJar;
  context?: Record<string, unknown>;
  circuitBreaker?: CircuitBreaker;
  maxRedirects?: number;
};

export type InternalOptions = Omit<Required<
  Omit<Options, "hooks" | "retry" | "timeout" | "prefixUrl" | "json" | "parseJson" | "stringifyJson" | "searchParams" | "onDownloadProgress" | "onUploadProgress" | "cookieJar" | "body" | "context" | "circuitBreaker" | "proxyUrl" | "dispatcher">
>, "headers"> & {
  headers: Headers;
  method: string;
  prefixUrl: string;
  timeout: number | false;
  hooks: Required<Hooks>;
  retry: InternalRetryOptions;
  signal: AbortSignal | undefined;
  json?: unknown;
  parseJson?: (text: string) => unknown;
  stringifyJson?: (data: unknown) => string;
  searchParams?: SearchParamsOption;
  onDownloadProgress?: Options["onDownloadProgress"];
  onUploadProgress?: Options["onUploadProgress"];
  cookieJar?: CookieJar;
  body?: BodyInit | null;
  context: Record<string, unknown>;
  duplex?: string;
  fetch: typeof globalThis.fetch;
  circuitBreaker?: CircuitBreaker;
  proxyUrl?: string;
  dispatcher?: unknown;
  maxRedirects?: number;
};

export type InternalRetryOptions = Required<Omit<RetryOptions, "shouldRetry" | "jitter">> & Pick<RetryOptions, "shouldRetry" | "jitter">;

export type NormalizedOptions = Omit<InternalOptions, "hooks" | "json" | "parseJson" | "stringifyJson" | "searchParams" | "timeout" | "throwHttpErrors" | "fetch"> & {
  retry: InternalRetryOptions;
};
