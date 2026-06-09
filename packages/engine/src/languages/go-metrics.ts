import type { Diagnostic, PlannedTask, StageResult, ToolRunResult } from "../contracts.js";
import { createLizardMetricsDiagnostics } from "../metrics-thresholds.js";
import * as commands from "../tools/command-builders.js";
import type { GoRunnerRuntime, SharedMetricsMode } from "./contracts.js";
import { runProjectBatches } from "./go-batches.js";
import { type GoProject, filterGoFiles, resolveGoProjects } from "./go-projects.js";
import {
  createUnsupportedGoRunnerNote,
  getGoMetricsProjectMetrics,
  resolveGoBinary,
  resolveGoProjectSourceFiles,
} from "./go-tools.js";
import {
  addSharedFileMetrics,
  createSharedMetricsTotals,
  resolveMetricsStageStatus,
} from "./metrics-accumulator.js";

type GoMetricsTotals = ReturnType<typeof createSharedMetricsTotals>;

export async function runGoMetricsTask(
  task: PlannedTask,
  runtime: GoRunnerRuntime,
  mode: SharedMetricsMode,
): Promise<StageResult> {
  const files = filterGoFiles(task.files);
  if (files.length === 0) {
    return runtime.createNoopStageResult(
      task.stageId,
      `No Go files were selected for ${task.stageId}.`,
    );
  }

  const diagnostics: Diagnostic[] = [];
  const notes: string[] = [];
  const toolRuns: ToolRunResult[] = [];
  let totalDurationMs = 0;
  const totals = createSharedMetricsTotals();
  let unsupportedFiles: string[] = [];

  try {
    unsupportedFiles = await collectGoProjectMetrics({
      addDurationMs: (durationMs) => {
        totalDurationMs += durationMs;
      },
      diagnostics,
      files,
      mode,
      runtime,
      toolRuns,
      totals,
    });
  } catch (error) {
    runtime.throwIfAbortError(error);
    return runtime.createExecutionFailureStage(
      task.stageId,
      "lizard",
      files[0] ?? runtime.cwd,
      error,
      totalDurationMs,
      diagnostics,
      toolRuns,
    );
  }

  appendGoMetricsNotes({
    mode,
    notes,
    runtime,
    stageId: task.stageId,
    toolRuns,
    totals,
    unsupportedFiles,
  });

  return {
    diagnostics,
    durationMs: totalDurationMs,
    notes,
    stageId: task.stageId,
    status: resolveMetricsStageStatus(diagnostics.length, unsupportedFiles.length),
    toolRuns,
  };
}

async function collectGoProjectMetrics(args: {
  addDurationMs: (durationMs: number) => void;
  diagnostics: Diagnostic[];
  files: readonly string[];
  mode: SharedMetricsMode;
  runtime: GoRunnerRuntime;
  toolRuns: ToolRunResult[];
  totals: GoMetricsTotals;
}): Promise<string[]> {
  const resolvedProjects = await resolveGoProjects(args.runtime.graph, args.files);
  const projects = await Promise.all(
    resolvedProjects.projects.map(async (project) => ({
      ...project,
      files: await resolveGoProjectSourceFiles(project, args.runtime),
    })),
  );

  for (const project of projects) {
    if (project.files.length === 0) {
      continue;
    }

    const cachedMetrics = await getGoMetricsProjectMetrics(project, args.runtime);
    args.addDurationMs(cachedMetrics.cacheHit ? 0 : cachedMetrics.metrics.durationMs);
    addSharedFileMetrics(args.totals, cachedMetrics.metrics.files);
    args.toolRuns.push(
      args.runtime.createToolRunResult(
        "lizard",
        cachedMetrics.metrics.args,
        cachedMetrics.cacheHit ? 0 : cachedMetrics.metrics.durationMs,
        cachedMetrics.metrics.exitCode,
        "passed",
        cachedMetrics.metrics.finishedAt,
        cachedMetrics.metrics.startedAt,
        cachedMetrics.cacheHit,
      ),
    );
    args.diagnostics.push(
      ...createLizardMetricsDiagnostics(cachedMetrics.metrics.files, args.mode, "lizard"),
    );
  }

  return resolvedProjects.unsupportedFiles;
}

function appendGoMetricsNotes(args: {
  mode: SharedMetricsMode;
  notes: string[];
  runtime: GoRunnerRuntime;
  stageId: StageResult["stageId"];
  toolRuns: readonly ToolRunResult[];
  totals: GoMetricsTotals;
  unsupportedFiles: readonly string[];
}): void {
  args.notes.push(
    args.runtime.readSharedMetricsNote(
      "Go",
      args.mode,
      args.totals.scannedFileCount,
      args.totals.totalSloc,
      args.totals.totalBlocks,
      args.totals.maxComplexity,
      args.totals.maxRank,
      args.totals.minMaintainability,
      args.totals.minMaintainabilityRank,
      "functions",
    ),
  );

  if (args.toolRuns.some((toolRun) => toolRun.cacheHit)) {
    args.notes.push("Reused cached Go metrics for this file batch.");
  }

  if (args.unsupportedFiles.length > 0) {
    args.notes.push(
      `Stage '${args.stageId}' is not implemented yet for non-Go files in this selection: ${args.unsupportedFiles.join(", ")}.`,
    );
  }
}
