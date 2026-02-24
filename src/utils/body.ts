/*!
 * @sptzx/request — MIT License
 * Derived from Ky — MIT License © Sindre Sorhus
 */

import type { Options } from "../types/options.js";
import { usualFormBoundarySize } from "../core/constants.js";

const sharedEncoder = new TextEncoder();

export const getBodySize = (body?: BodyInit | null): number => {
  if (!body) return 0;
  if (body instanceof FormData) {
    let size = 0;
    for (const [key, value] of body) {
      size += usualFormBoundarySize;
      size += sharedEncoder.encode(`Content-Disposition: form-data; name="${key}"`).length;
      size += typeof value === "string" ? sharedEncoder.encode(value).length : value.size;
    }
    return size;
  }
  if (body instanceof Blob) return body.size;
  if (body instanceof ArrayBuffer) return body.byteLength;
  if (typeof body === "string") return sharedEncoder.encode(body).length;
  if (body instanceof URLSearchParams) return sharedEncoder.encode(body.toString()).length;
  if ("byteLength" in body) return (body as ArrayBufferView).byteLength;
  return 0;
};

const withProgress = (
  stream: ReadableStream<Uint8Array>,
  totalBytes: number,
  onProgress: Options["onDownloadProgress"] | Options["onUploadProgress"]
): ReadableStream<Uint8Array> => {
  let previousChunk: Uint8Array | undefined;
  let transferredBytes = 0;

  return stream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(currentChunk, controller) {
        controller.enqueue(currentChunk);
        if (previousChunk) {
          transferredBytes += previousChunk.byteLength;
          let percent = totalBytes === 0 ? 0 : transferredBytes / totalBytes;
          if (percent >= 1) percent = 1 - Number.EPSILON;
          onProgress?.({ percent, totalBytes: Math.max(totalBytes, transferredBytes), transferredBytes }, previousChunk);
        }
        previousChunk = currentChunk;
      },
      flush() {
        if (previousChunk) {
          transferredBytes += previousChunk.byteLength;
          onProgress?.({ percent: 1, totalBytes: Math.max(totalBytes, transferredBytes), transferredBytes }, previousChunk);
        }
      },
    })
  );
};

export const streamResponse = (
  response: Response,
  onDownloadProgress: Options["onDownloadProgress"]
): Response => {
  if (!response.body) return response;
  if (response.status === 204) {
    return new Response(null, { status: response.status, statusText: response.statusText, headers: response.headers });
  }
  const totalBytes = Math.max(0, Number(response.headers.get("content-length")) || 0);
  return new Response(withProgress(response.body, totalBytes, onDownloadProgress), {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};

export const streamRequest = (
  request: Request,
  onUploadProgress: Options["onUploadProgress"],
  originalBody?: BodyInit | null
): Request => {
  if (!request.body) return request;
  const totalBytes = getBodySize(originalBody ?? request.body);
  return new Request(request, {
    duplex: "half",
    body: withProgress(request.body, totalBytes, onUploadProgress),
  } as RequestInit);
};

export async function* streamNdjson<T = unknown>(response: Response): AsyncGenerator<T, void, undefined> {
  const body = response.body;
  if (!body) return;

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (line.length > 0) yield JSON.parse(line) as T;
      }
    }
    buffer += decoder.decode();
    const line = buffer.trim();
    if (line.length > 0) yield JSON.parse(line) as T;
  } finally {
    void reader.cancel().catch(() => undefined);
  }
}
