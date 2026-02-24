/*!
 * @sptzx/request — MIT License
 * Derived from Ky — MIT License © Sindre Sorhus
 */
import type { Input, Options } from "../types/options.js";
import type { ResponsePromise } from "../types/ResponsePromise.js";
export declare class FetchEngine {
    #private;
    static create(input: Input, options: Options): ResponsePromise;
    request: Request;
    constructor(input: Input, options?: Options);
}
//# sourceMappingURL=FetchEngine.d.ts.map