import type { Diagnostic, PlannedTask, StageResult, ToolRunResult } from "../contracts.js";
import { createLizardMetricsDiagnostics } from "../metrics-thresholds.js";
import type { JvmRunnerRuntime, SharedMetricsMode } from "./contracts.js";
import { filterJvmFiles, resolveJvmProjects, runProjectBatches } from "./jvm-projects.js";
import {
  createUnsupportedJvmRunnerNote,
  getJvmMetricsProjectMetrics,
  resolveJvmMetricsFiles,
} from "./jvm-tools.js";
import {
  addSharedFileMetrics,
  createSharedMetricsTotals,
  resolveMetricsStageStatus,
} from "./metrics-accumulator.js";

type JvmMetricsTotals = ReturnType<typeof createSharedMetricsTotals>;

export async function runJvmMetricsTask(
  task: PlannedTask,
  runtime: JvmRunnerRuntime,
  mode: SharedMetricsMode,
): Promise<StageResult> {
  const files = filterJvmFiles(task.files);
  if (files.length === 0) {
    return runtime.createNoopStageResult(
      task.stageId,
      `No JVM files were selected for ${task.stageId}.`,
    );
  }

  const diagnostics: Diagnostic[] = [];
  const notes: string[] = [];
  const toolRuns: ToolRunResult[] = [];
  let totalDurationMs = 0;
  const totals = createSharedMetricsTotals();
  let unsupportedFiles: string[] = [];

  try {
    unsupportedFiles = await collectJvmProjectMetrics({
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

  appendJvmMetricsNotes({
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

async function collectJvmProjectMetrics(args: {
  addDurationMs: (durationMs: number) => void;
  diagnostics: Diagnostic[];
  files: readonly string[];
  mode: SharedMetricsMode;
  runtime: JvmRunnerRuntime;
  toolRuns: ToolRunResult[];
  totals: JvmMetricsTotals;
}): Promise<string[]> {
  const resolvedProjects = await resolveJvmProjects(args.runtime.graph, args.files);
  const projects = await Promise.all(
    resolvedProjects.projects.map(async (project) => ({
      ...project,
      files: await resolveJvmMetricsFiles(project, args.runtime),
    })),
  );

  for (const project of projects) {
    if (project.files.length === 0) {
      continue;
    }

    const cachedMetrics = await getJvmMetricsProjectMetrics(project, args.runtime);
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

function appendJvmMetricsNotes(args: {
  mode: SharedMetricsMode;
  notes: string[];
  runtime: JvmRunnerRuntime;
  stageId: StageResult["stageId"];
  toolRuns: readonly ToolRunResult[];
  totals: JvmMetricsTotals;
  unsupportedFiles: readonly string[];
}): void {
  args.notes.push(
    args.runtime.readSharedMetricsNote(
      "JVM",
      args.mode,
      args.totals.scannedFileCount,
      args.totals.totalSloc,
      args.totals.totalBlocks,
      args.totals.maxComplexity,
      args.totals.maxRank,
      args.totals.minMaintainability,
      args.totals.minMaintainabilityRank,
      "methods",
    ),
  );

  if (args.toolRuns.some((toolRun) => toolRun.cacheHit)) {
    args.notes.push("Reused cached JVM metrics for this file batch.");
  }

  if (args.unsupportedFiles.length > 0) {
    args.notes.push(
      `Stage '${args.stageId}' is not implemented yet for non-JVM files in this selection: ${args.unsupportedFiles.join(", ")}.`,
    );
  }
}
