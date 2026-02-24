import type { Input, Options } from "./options.js";
import type { ResponsePromise } from "./ResponsePromise.js";
import type { ForceRetryOptions, RetryMarker } from "../core/constants.js";

export type KyInstance = {
  (input: Input, options?: Options): ResponsePromise;
  get(input: Input, options?: Options): ResponsePromise;
  post(input: Input, options?: Options): ResponsePromise;
  put(input: Input, options?: Options): ResponsePromise;
  patch(input: Input, options?: Options): ResponsePromise;
  head(input: Input, options?: Options): ResponsePromise;
  delete(input: Input, options?: Options): ResponsePromise;
  create(defaultOptions?: Options): KyInstance;
  extend(defaultOptions?: Partial<Options> | ((parentDefaults: Partial<Options>) => Partial<Options>)): KyInstance;
  stop: symbol;
  retry(options?: ForceRetryOptions): RetryMarker;
};
