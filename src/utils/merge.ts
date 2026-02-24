/*!
 * @sptzx/request — MIT License
 * Derived from Ky — MIT License © Sindre Sorhus
 */

import type { Hooks } from "../types/hooks.js";
import type { KyHeadersInit, Options } from "../types/options.js";
import { supportsAbortSignal } from "../core/constants.js";
import { isObject } from "./is.js";

const CRLF_RE = /[\r\n]/g;

function sanitizeHeaderValue(value: string): string {
  return CRLF_RE.test(value) ? value.replace(CRLF_RE, "") : value;
}

const PROTOTYPE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export const validateAndMerge = (...sources: Array<Partial<Options> | undefined>): Partial<Options> => {
  for (const source of sources) {
    if ((!isObject(source) || Array.isArray(source)) && source !== undefined) {
      throw new TypeError("The `options` argument must be an object");
    }
  }
  return deepMerge({}, ...sources);
};

export const mergeHeaders = (source1: KyHeadersInit = {}, source2: KyHeadersInit = {}): Headers => {
  const result = new globalThis.Headers(source1 as RequestInit["headers"]);
  const isHeadersInstance = source2 instanceof globalThis.Headers;
  const source = new globalThis.Headers(source2 as RequestInit["headers"]);

  for (const [key, value] of source.entries()) {
    if ((isHeadersInstance && value === "undefined") || value === undefined) {
      result.delete(key);
    } else {
      result.set(key, sanitizeHeaderValue(value));
    }
  }

  return result;
};

function newHookValue<K extends keyof Hooks>(original: Hooks, incoming: Hooks, property: K): Required<Hooks>[K] {
  return Object.hasOwn(incoming, property) && incoming[property] === undefined
    ? ([] as unknown as Required<Hooks>[K])
    : deepMerge<Required<Hooks>[K]>(
        (original[property] ?? []) as Required<Hooks>[K],
        (incoming[property] ?? []) as Required<Hooks>[K]
      );
}

export const mergeHooks = (original: Hooks = {}, incoming: Hooks = {}): Required<Hooks> => ({
  beforeRequest: newHookValue(original, incoming, "beforeRequest"),
  beforeRetry: newHookValue(original, incoming, "beforeRetry"),
  afterResponse: newHookValue(original, incoming, "afterResponse"),
  beforeError: newHookValue(original, incoming, "beforeError"),
});

const appendSearchParameters = (target: unknown, source: unknown): URLSearchParams => {
  const result = new URLSearchParams();

  for (const input of [target, source]) {
    if (input === undefined) continue;
    if (input instanceof URLSearchParams) {
      for (const [k, v] of input.entries()) result.append(k, v);
    } else if (Array.isArray(input)) {
      for (const pair of input as unknown[]) {
        if (!Array.isArray(pair) || pair.length !== 2) {
          throw new TypeError("Array search parameters must be [[key, value], ...] format");
        }
        result.append(String((pair as unknown[])[0]), String((pair as unknown[])[1]));
      }
    } else if (isObject(input)) {
      for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
        if (v !== undefined) result.append(k, String(v));
      }
    } else {
      for (const [k, v] of new URLSearchParams(input as string).entries()) result.append(k, v);
    }
  }

  return result;
};

export const deepMerge = <T>(...sources: Array<Partial<T> | undefined>): T => {
  let returnValue: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  let headers: KyHeadersInit = {};
  let hooks: Hooks = {};
  let searchParameters: unknown;
  const signals: AbortSignal[] = [];

  for (const source of sources) {
    if (Array.isArray(source)) {
      (returnValue as unknown) = [...(Array.isArray(returnValue) ? returnValue : []), ...(source as unknown[])];
      continue;
    }
    if (!isObject(source)) continue;

    for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
      if (PROTOTYPE_KEYS.has(key)) continue;

      if (key === "signal" && value instanceof globalThis.AbortSignal) {
        signals.push(value);
        continue;
      }

      if (key === "context") {
        if (value !== undefined && value !== null && (!isObject(value) || Array.isArray(value))) {
          throw new TypeError("The `context` option must be an object");
        }
        returnValue["context"] = value === undefined || value === null
          ? {}
          : { ...(returnValue["context"] as Record<string, unknown> | undefined), ...(value as Record<string, unknown>) };
        continue;
      }

      if (key === "searchParams") {
        searchParameters = (value === undefined || value === null)
          ? undefined
          : searchParameters === undefined ? value : appendSearchParameters(searchParameters, value);
        continue;
      }

      if (key === "hooks") {
        hooks = mergeHooks(hooks, value as Hooks);
        returnValue["hooks"] = hooks;
        continue;
      }

      if (key === "headers") {
        headers = mergeHeaders(headers as KyHeadersInit, value as KyHeadersInit);
        returnValue["headers"] = headers;
        continue;
      }

      if (isObject(value) && key in returnValue) {
        returnValue[key] = deepMerge(returnValue[key] as Partial<unknown>, value);
      } else {
        returnValue[key] = value;
      }
    }
  }

  if (searchParameters !== undefined) returnValue["searchParams"] = searchParameters;

  if (signals.length === 1) {
    returnValue["signal"] = signals[0];
  } else if (signals.length > 1) {
    returnValue["signal"] = supportsAbortSignal ? AbortSignal.any(signals) : signals.at(-1);
  }

  return returnValue as unknown as T;
};
