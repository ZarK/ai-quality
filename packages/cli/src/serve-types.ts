import type { LoadedAiqProgress } from "@tjalve/aiq/config";
import type { ManifestSource, RunRequest } from "@tjalve/aiq/model";

import { maxServeRequestBodyBytes } from "./types.js";

export interface ServeManifestRequest {
  files: string[];
  source?: ManifestSource;
}

export interface ServeRunRequestBody {
  manifest: ServeManifestRequest;
  outDir?: string;
  profile?: string;
  stages?: string[];
}

export interface ServeRunLock {
  active: boolean;
}

export interface PreparedServeRun {
  progress?: LoadedAiqProgress;
  request: RunRequest;
}

export class ServeRequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServeRequestValidationError";
  }
}

export class ServeRequestTooLargeError extends ServeRequestValidationError {
  readonly closeConnection: boolean;

  constructor(
    message = `Serve request body exceeds ${maxServeRequestBodyBytes} bytes.`,
    closeConnection = false,
  ) {
    super(message);
    this.name = "ServeRequestTooLargeError";
    this.closeConnection = closeConnection;
  }
}

export class ServeRequestCancelledError extends Error {
  constructor(message = "AIQ serve request cancelled.") {
    super(message);
    this.name = "ServeRequestCancelledError";
  }
}
