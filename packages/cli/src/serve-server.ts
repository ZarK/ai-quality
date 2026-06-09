import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import {
  ServeRequestCancelledError,
  ServeRequestTooLargeError,
  ServeRequestValidationError,
  type ServeRunLock,
} from "./serve-types.js";
import { type ActiveSignal, formatError } from "./shared.js";
import { maxServeRequestBodyBytes } from "./types.js";

export function tryAcquireServeRunLock(runLock: ServeRunLock): (() => void) | undefined {
  if (runLock.active) {
    return undefined;
  }

  runLock.active = true;
  return () => {
    runLock.active = false;
  };
}

export function writeBusyServeResponse(response: ServerResponse): void {
  response.setHeader("retry-after", "1");
  writeJsonResponse(response, 503, { error: "AIQ serve is already processing another run." });
}

export function createServeRequestSignal(
  request: IncomingMessage,
  response: ServerResponse,
  parentSignal: AbortSignal,
): ActiveSignal {
  const controller = new AbortController();
  const abort = (): void => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
  };
  const abortOnResponseClose = (): void => {
    if (!response.writableEnded) {
      abort();
    }
  };

  if (parentSignal.aborted) {
    abort();
  } else {
    parentSignal.addEventListener("abort", abort, { once: true });
  }

  const abortOnRequestClose = (): void => {
    if (request.destroyed && !request.complete) {
      abort();
    }
  };

  request.on("close", abortOnRequestClose);
  response.on("close", abortOnResponseClose);

  return {
    cleanup() {
      parentSignal.removeEventListener("abort", abort);
      request.off("close", abortOnRequestClose);
      response.off("close", abortOnResponseClose);
    },
    signal: controller.signal,
  };
}

export function writeJsonResponse(
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
): void {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(`${JSON.stringify(payload)}\n`);
}

export async function readJsonRequest(
  request: IncomingMessage,
  signal?: AbortSignal,
): Promise<unknown> {
  const contentLength = request.headers["content-length"];
  const declaredBodyBytes = typeof contentLength === "string" ? Number(contentLength) : undefined;
  const declaredTooLarge =
    declaredBodyBytes !== undefined &&
    Number.isFinite(declaredBodyBytes) &&
    declaredBodyBytes > maxServeRequestBodyBytes;

  const body = await readRequestBody(request, declaredTooLarge, signal);
  if (body.trim().length === 0) {
    throw new ServeRequestValidationError("Serve requests require a JSON body.");
  }

  try {
    return JSON.parse(body) as unknown;
  } catch (error) {
    throw new ServeRequestValidationError(`Invalid JSON body: ${formatError(error)}`);
  }
}

function readRequestBody(
  request: IncomingMessage,
  declaredTooLarge: boolean,
  signal?: AbortSignal,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let value = "";
    let byteLength = 0;
    let tooLarge = declaredTooLarge;
    let settled = false;
    const cleanup = (): void => {
      request.off("close", onClose);
      request.off("data", onData);
      request.off("end", onEnd);
      request.off("error", onError);
      signal?.removeEventListener("abort", onAbort);
    };
    const rejectOnce = (error: Error): void => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      reject(error);
    };
    const resolveOnce = (result: string): void => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(result);
    };
    const onAbort = (): void => rejectOnce(new ServeRequestCancelledError());
    const onClose = (): void => {
      if (request.destroyed && !request.complete) {
        rejectOnce(new ServeRequestCancelledError());
      }
    };
    const onData = (chunk: string): void => {
      byteLength += Buffer.byteLength(chunk, "utf8");
      if (byteLength > maxServeRequestBodyBytes) {
        tooLarge = true;
      }

      if (tooLarge) {
        rejectOnce(new ServeRequestTooLargeError(undefined, true));
        return;
      }

      value += chunk;
    };
    const onEnd = (): void => {
      if (!tooLarge) {
        resolveOnce(value);
      }
    };
    const onError = (error: Error): void => rejectOnce(error);

    if (signal?.aborted) {
      rejectOnce(new ServeRequestCancelledError());
      return;
    }

    if (declaredTooLarge) {
      rejectOnce(new ServeRequestTooLargeError(undefined, true));
      return;
    }

    request.setEncoding("utf8");
    request.on("close", onClose);
    request.on("data", onData);
    request.on("end", onEnd);
    request.on("error", onError);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function destroyRequestAfterResponse(
  request: IncomingMessage,
  response: ServerResponse,
): void {
  const destroyRequest = (): void => {
    if (!request.destroyed) {
      request.destroy();
    }
  };

  if (response.writableEnded || response.destroyed) {
    destroyRequest();
    return;
  }

  response.once("finish", destroyRequest);
}

export async function listenServer(
  server: Server,
  host: string,
  port: number,
): Promise<AddressInfo> {
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error): void => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = (): void => {
      server.off("error", onError);
      resolve();
    };

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });

  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("AIQ serve expected a TCP address.");
  }

  return address;
}

export async function closeServer(server: Server): Promise<void> {
  if (!server.listening) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error === undefined) {
        resolve();
        return;
      }

      reject(error);
    });
  });
}
