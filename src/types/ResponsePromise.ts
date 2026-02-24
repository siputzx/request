/*!
 * @sptzx/request — MIT License
 */

export type ResponsePromise = Promise<Response> & {
  arrayBuffer: () => Promise<ArrayBuffer>;
  blob: () => Promise<Blob>;
  bytes?: () => Promise<Uint8Array>;
  formData: () => Promise<FormData>;
  json: <T = unknown>() => Promise<T>;
  text: () => Promise<string>;
  ndjson: <T = unknown>() => AsyncGenerator<T, void, undefined>;
  stream: () => ReadableStream<Uint8Array> | null;
};
