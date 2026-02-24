/*!
 * @sptzx/request — MIT License
 * Derived from Ky — MIT License © Sindre Sorhus
 */
import type { Options } from "../types/options.js";
export declare const getBodySize: (body?: BodyInit | null) => number;
export declare const streamResponse: (response: Response, onDownloadProgress: Options["onDownloadProgress"]) => Response;
export declare const streamRequest: (request: Request, onUploadProgress: Options["onUploadProgress"], originalBody?: BodyInit | null) => Request;
export declare function streamNdjson<T = unknown>(response: Response): AsyncGenerator<T, void, undefined>;
//# sourceMappingURL=body.d.ts.map