import path from "node:path";

import {
  type LoadedAiqProgress,
  loadAiqProgress,
  resolveAiqProgressStageIds,
} from "@tjalve/aiq/config";
import { buildRunPlan, resolveRunRequest } from "@tjalve/aiq/engine";
import type { RunRequest } from "@tjalve/aiq/model";

import { createManifestInput, resolveCliConfig } from "./requests.js";
import type { CliIo, ParsedArgs } from "./types.js";
import { defaultWatchCadenceMs } from "./types.js";
import { buildWatchReplanPaths, buildWatchTargets } from "./watch-targets.js";
import type { PreparedWatchExecution, WatchPreparedRun } from "./watch-types.js";

export async function createWatchPreparedRun(
  parsed: ParsedArgs,
  io: CliIo,
  cachedStreamFiles?: string[],
): Promise<WatchPreparedRun> {
  const manifest = await createManifestInput(parsed, io, cachedStreamFiles);
  const progress = await loadOptionalWatchProgress(parsed, io);
  const watchProgressPath = usesWatchProgressDefaults(parsed);
  const resolvedConfig = await resolveCliConfig(parsed, io, {
    ...(progress === undefined
      ? {}
      : { stageOverrides: resolveAiqProgressStageIds(progress.progress.current_stage) }),
    surface: "watch",
  });
  const baseRequest: RunRequest = {
    context: "watch",
    cwd: resolvedConfig.cwd,
    manifest,
    mode: "check",
    ...(parsed.outDir === undefined ? {} : { outDir: parsed.outDir }),
    profile: resolvedConfig.profile,
    writeArtifacts: true,
  };
  const cadenceStageSet = new Set(resolvedConfig.cadenceStages);
  const continuousStages = resolvedConfig.stages.filter((stageId) => !cadenceStageSet.has(stageId));
  const requestOptions =
    resolvedConfig.stageConfigurations === undefined
      ? {}
      : { stageConfigurations: resolvedConfig.stageConfigurations };
  const filesFromPath =
    parsed.filesFrom === undefined ? undefined : path.resolve(io.cwd, parsed.filesFrom);
  const [targetRequest, continuous, cadence] = await Promise.all([
    resolveRunRequest({
      ...baseRequest,
      stages: resolvedConfig.stages,
      ...requestOptions,
    }),
    createPreparedWatchExecution({
      ...baseRequest,
      stages: continuousStages,
      ...requestOptions,
    }),
    createPreparedWatchExecution({
      ...baseRequest,
      stages: resolvedConfig.cadenceStages,
      ...requestOptions,
    }),
  ]);
  const replanPaths = buildWatchReplanPaths(
    targetRequest.cwd,
    resolvedConfig.configPath,
    progress?.path,
    watchProgressPath,
    filesFromPath,
  );
  const preparedRun: WatchPreparedRun = {
    ...(progress === undefined ? {} : { progress }),
    replanPaths,
    replanWatchPaths: [...replanPaths],
    targets: buildWatchTargets(
      targetRequest.cwd,
      targetRequest.manifest.files,
      resolvedConfig.configPath,
      progress?.path,
      watchProgressPath,
      filesFromPath,
    ),
  };

  if (continuous !== undefined) {
    preparedRun.continuous = continuous;
  }

  if (cadence !== undefined) {
    preparedRun.cadence = cadence;
    preparedRun.cadenceMs = resolvedConfig.cadenceMs ?? defaultWatchCadenceMs;
  }

  return preparedRun;
}

async function createPreparedWatchExecution(
  request: RunRequest,
): Promise<PreparedWatchExecution | undefined> {
  if (request.stages === undefined || request.stages.length === 0) {
    return undefined;
  }

  const resolvedRequest = await resolveRunRequest(request);
  return {
    plan: buildRunPlan(resolvedRequest),
    request: resolvedRequest,
  };
}

async function loadOptionalWatchProgress(
  parsed: ParsedArgs,
  io: CliIo,
): Promise<LoadedAiqProgress | undefined> {
  if (!usesWatchProgressDefaults(parsed)) {
    return undefined;
  }

  const progress = await loadAiqProgress(io.cwd);
  return progress.source === "file" ? progress : undefined;
}

export function usesWatchProgressDefaults(parsed: ParsedArgs): boolean {
  return parsed.stages.length === 0 && parsed.profile === undefined;
}
