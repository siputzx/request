/*!
 * @sptzx/request — MIT License
 * Derived from Ky — MIT License © Sindre Sorhus
 */
import type { Hooks } from "../types/hooks.js";
import type { KyHeadersInit, Options } from "../types/options.js";
export declare const validateAndMerge: (...sources: Array<Partial<Options> | undefined>) => Partial<Options>;
export declare const mergeHeaders: (source1?: KyHeadersInit, source2?: KyHeadersInit) => Headers;
export declare const mergeHooks: (original?: Hooks, incoming?: Hooks) => Required<Hooks>;
export declare const deepMerge: <T>(...sources: Array<Partial<T> | undefined>) => T;
//# sourceMappingURL=merge.d.ts.map