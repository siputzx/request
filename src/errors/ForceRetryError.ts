/*
 * Derived from Ky — MIT License © Sindre Sorhus
 */

import type { ForceRetryOptions } from "../core/constants.js";
import { NonError } from "./NonError.js";

export class ForceRetryError extends Error {
  override name = "ForceRetryError" as const;
  customDelay: number | undefined;
  code: string | undefined;
  customRequest: Request | undefined;

  constructor(options?: ForceRetryOptions) {
    const cause = options?.cause
      ? options.cause instanceof Error
        ? options.cause
        : new NonError(options.cause)
      : undefined;
    super(
      options?.code ? `Forced retry: ${options.code}` : "Forced retry",
      cause ? { cause } : undefined
    );
    this.customDelay = options?.delay;
    this.code = options?.code;
    this.customRequest = options?.request;
  }
}
