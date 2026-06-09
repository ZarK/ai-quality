import type { StageId, StageResult } from "../contracts.js";
import { resolveProjectConcurrencyLimit } from "../runtime-tunables.js";
import type { HashicorpRunnerRuntime } from "./contracts.js";

export function cloneToolRunResult(
  toolRun: StageResult["toolRuns"][number],
  cacheHit: boolean,
  runtime: HashicorpRunnerRuntime,
): StageResult["toolRuns"][number] {
  return runtime.createToolRunResult(
    toolRun.tool,
    toolRun.args,
    cacheHit ? 0 : toolRun.durationMs,
    toolRun.exitCode,
    toolRun.status,
    toolRun.finishedAt,
    toolRun.startedAt,
    cacheHit,
  );
}

export function combineStageResults(
  stageId: StageId,
  results: readonly StageResult[],
  runtime: HashicorpRunnerRuntime,
): StageResult {
  const activeResults = results.filter((result) => !isNoopStageResult(result));
  if (activeResults.length === 0) {
    return runtime.createNoopStageResult(
      stageId,
      `No supported files were selected for ${stageId}.`,
    );
  }

  return {
    diagnostics: activeResults.flatMap((result) => result.diagnostics),
    durationMs: activeResults.reduce((total, result) => total + result.durationMs, 0),
    notes: activeResults.flatMap((result) => result.notes),
    stageId,
    status: summarizeProjectStageStatus(activeResults.map((result) => result.status)),
    toolRuns: activeResults.flatMap((result) => result.toolRuns),
  };
}

export function isNoopStageResult(result: StageResult): boolean {
  return (
    result.status === "passed" &&
    result.durationMs === 0 &&
    result.diagnostics.length === 0 &&
    result.toolRuns.length === 0
  );
}

export async function runProjectBatches<TProject, TResult>(
  projects: readonly TProject[],
  runProject: (project: TProject) => Promise<TResult>,
  concurrencyLimit = resolveProjectConcurrencyLimit(),
): Promise<TResult[]> {
  const results: TResult[] = [];

  for (let index = 0; index < projects.length; index += concurrencyLimit) {
    const projectBatch = projects.slice(index, index + concurrencyLimit);
    results.push(...(await Promise.all(projectBatch.map((project) => runProject(project)))));
  }

  return results;
}

export function summarizeProjectStageStatus(
  statuses: readonly StageResult["status"][],
): StageResult["status"] {
  if (statuses.length === 0) {
    return "passed";
  }

  if (statuses.includes("failed")) {
    return "failed";
  }

  if (statuses.includes("not_implemented")) {
    return "not_implemented";
  }

  return "passed";
}
