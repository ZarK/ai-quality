import type { IncomingMessage, ServerResponse } from "node:http";

import {
  type LoadedAiqProgress,
  loadAiqProgress,
  resolveAiqProgressStageIds,
} from "@tjalve/aiq/config";
import { resolveRunRequest, runEngine } from "@tjalve/aiq/engine";
import type { RunRequest } from "@tjalve/aiq/model";

import { resolveCliConfig } from "./requests.js";
import { parseProfile, parseServeRunRequestBody, parseStageList } from "./serve-parse.js";
import {
  createServeRequestSignal,
  destroyRequestAfterResponse,
  readJsonRequest,
  tryAcquireServeRunLock,
  writeBusyServeResponse,
  writeJsonResponse,
} from "./serve-server.js";
import {
  type PreparedServeRun,
  ServeRequestCancelledError,
  ServeRequestTooLargeError,
  ServeRequestValidationError,
  type ServeRunLock,
  type ServeRunRequestBody,
} from "./serve-types.js";
import { formatError, isCliCancellation } from "./shared.js";
import type { CliIo, ParsedArgs } from "./types.js";
import { createRunWorkflowOutput } from "./workflow.js";

export async function handleServeRequest(
  request: IncomingMessage,
  response: ServerResponse,
  parsed: ParsedArgs,
  io: CliIo,
  signal: AbortSignal,
  runLock: ServeRunLock,
): Promise<void> {
  const requestSignal = createServeRequestSignal(request, response, signal);
  let releaseLock: (() => void) | undefined;

  try {
    if (request.method === "GET" && (request.url === "/health" || request.url === "/healthz")) {
      writeJsonResponse(response, 200, { ok: true });
      return;
    }

    if (request.method !== "POST" || request.url !== "/run") {
      writeJsonResponse(response, 404, { error: "Not found." });
      return;
    }

    releaseLock = tryAcquireServeRunLock(runLock);
    if (releaseLock === undefined) {
      response.setHeader("connection", "close");
      writeBusyServeResponse(response);
      destroyRequestAfterResponse(request, response);
      return;
    }

    const body = parseServeRunRequestBody(await readJsonRequest(request, requestSignal.signal));
    const preparedRun = await createServeRunRequest(body, parsed, io, requestSignal.signal);
    const result = await runEngine(preparedRun.request);
    if (!response.destroyed && !response.writableEnded) {
      writeJsonResponse(response, 200, {
        ...result,
        ...(preparedRun.progress === undefined
          ? {}
          : {
              workflow: createRunWorkflowOutput(preparedRun.progress, preparedRun.request, result),
            }),
      });
    }
  } catch (error) {
    handleServeError(error, request, response, signal, requestSignal.signal);
  } finally {
    releaseLock?.();
    requestSignal.cleanup();
  }
}

function handleServeError(
  error: unknown,
  request: IncomingMessage,
  response: ServerResponse,
  signal: AbortSignal,
  requestSignal: AbortSignal,
): void {
  if (isCliCancellation(error, signal)) {
    if (!response.headersSent && !response.destroyed) {
      writeJsonResponse(response, 503, { error: "AIQ serve is shutting down." });
    }
    return;
  }

  if (error instanceof ServeRequestCancelledError || isCliCancellation(error, requestSignal)) {
    return;
  }

  const statusCode = resolveServeErrorStatusCode(error);
  if (shouldCloseServeConnection(error)) {
    response.setHeader("connection", "close");
    destroyRequestAfterResponse(request, response);
  }
  if (!response.headersSent && !response.destroyed) {
    writeJsonResponse(response, statusCode, { error: formatError(error) });
  }
}

function resolveServeErrorStatusCode(error: unknown): number {
  if (error instanceof ServeRequestTooLargeError) {
    return 413;
  }

  return error instanceof ServeRequestValidationError ? 400 : 500;
}

function shouldCloseServeConnection(error: unknown): boolean {
  return error instanceof ServeRequestTooLargeError && error.closeConnection;
}

async function createServeRunRequest(
  body: ServeRunRequestBody,
  parsed: ParsedArgs,
  io: CliIo,
  signal: AbortSignal,
): Promise<PreparedServeRun> {
  const stageOverrides =
    body.stages === undefined ? undefined : parseStageList(body.stages, "serve stages");
  const profileOverride =
    body.profile === undefined ? undefined : parseProfile(body.profile, "serve profile");
  const progress = await loadOptionalServeProgress(body, parsed, io);
  const resolvedConfig = await resolveCliConfig(parsed, io, {
    surface: "serve",
    ...(stageOverrides === undefined
      ? progress === undefined
        ? {}
        : { stageOverrides: resolveAiqProgressStageIds(progress.progress.current_stage) }
      : { stageOverrides }),
    ...(profileOverride === undefined ? {} : { profileOverride }),
  });

  const runRequest: RunRequest = {
    context: "serve",
    cwd: resolvedConfig.cwd,
    manifest: {
      files: body.manifest.files,
      source: body.manifest.source ?? "direct",
    },
    mode: "check",
    ...((body.outDir ?? parsed.outDir) ? { outDir: body.outDir ?? parsed.outDir } : {}),
    stages: resolvedConfig.stages,
    profile: resolvedConfig.profile,
    signal,
    writeArtifacts: true,
  };

  try {
    await resolveRunRequest(runRequest);
  } catch (error) {
    throw new ServeRequestValidationError(formatError(error));
  }

  return {
    ...(progress === undefined ? {} : { progress }),
    request: runRequest,
  };
}

async function loadOptionalServeProgress(
  body: ServeRunRequestBody,
  parsed: ParsedArgs,
  io: CliIo,
): Promise<LoadedAiqProgress | undefined> {
  if (
    body.stages !== undefined ||
    body.profile !== undefined ||
    parsed.stages.length > 0 ||
    parsed.profile !== undefined
  ) {
    return undefined;
  }

  const progress = await loadAiqProgress(io.cwd);
  return progress.source === "file" ? progress : undefined;
}
