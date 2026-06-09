import type { Diagnostic, PlannedTask, StageResult, ToolRunResult } from "../contracts.js";
import { createPythonMetricsDiagnostics } from "../metrics-thresholds.js";
import * as parsers from "../parsers/index.js";
import type { PythonRunnerRuntime, SharedMetricsMode } from "./contracts.js";
import {
  addPythonFileMetrics,
  createSharedMetricsTotals,
  resolveMetricsStageStatus,
} from "./metrics-accumulator.js";
import {
  filterPythonTaskFiles,
  isPythonTaskFile,
  resolvePythonProjects,
  resolvePythonSourceProject,
} from "./python-projects.js";
import { getPythonMetricsProjectMetrics } from "./python-tools.js";

type PythonMetricsTotals = ReturnType<typeof createSharedMetricsTotals>;

export async function runPythonComplexityTask(
  task: PlannedTask,
  runtime: PythonRunnerRuntime,
): Promise<StageResult> {
  return runPythonMetricsTask(task, runtime, "complexity");
}

export async function runPythonSlocTask(
  task: PlannedTask,
  runtime: PythonRunnerRuntime,
): Promise<StageResult> {
  return runPythonMetricsTask(task, runtime, "sloc");
}

export async function runPythonMaintainabilityTask(
  task: PlannedTask,
  runtime: PythonRunnerRuntime,
): Promise<StageResult> {
  return runPythonMetricsTask(task, runtime, "maintainability");
}

async function runPythonMetricsTask(
  task: PlannedTask,
  runtime: PythonRunnerRuntime,
  mode: SharedMetricsMode,
): Promise<StageResult> {
  const files = filterPythonTaskFiles(task.files);
  if (files.length === 0) {
    if (task.files.some((file) => runtime.isSharedMetricsCompanionFile(file))) {
      return runtime.createNoopStageResult(
        task.stageId,
        `No Python files were selected for ${task.stageId}.`,
      );
    }

    return runtime.createNotImplementedStageResult(
      task.stageId,
      runtime.createSharedMetricsNotImplementedNote(task.stageId),
    );
  }

  const unsupportedFiles = task.files.filter((file) => {
    return !isPythonTaskFile(file) && !runtime.isSharedMetricsCompanionFile(file);
  });
  const diagnostics: Diagnostic[] = [];
  const notes: string[] = [];
  const toolRuns: StageResult["toolRuns"] = [];
  let totalDurationMs = 0;
  const totals = createSharedMetricsTotals();

  try {
    await collectPythonProjectMetrics({
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
      "radon",
      files[0] ?? runtime.cwd,
      error,
      totalDurationMs,
      diagnostics,
      toolRuns,
    );
  }

  appendPythonMetricsNotes({
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

async function collectPythonProjectMetrics(args: {
  addDurationMs: (durationMs: number) => void;
  diagnostics: Diagnostic[];
  files: readonly string[];
  mode: SharedMetricsMode;
  runtime: PythonRunnerRuntime;
  toolRuns: StageResult["toolRuns"];
  totals: PythonMetricsTotals;
}): Promise<void> {
  const projects = await resolvePythonProjects(args.runtime.graph, args.files);
  for (const project of projects) {
    const cachedMetrics = await getPythonMetricsProjectMetrics(
      await resolvePythonSourceProject(project, args.runtime),
      args.runtime,
    );
    args.addDurationMs(cachedMetrics.cacheHit ? 0 : cachedMetrics.metrics.durationMs);
    addPythonFileMetrics(args.totals, cachedMetrics.metrics.files);
    args.toolRuns.push(
      args.runtime.createToolRunResult(
        "radon",
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
      ...createPythonMetricsDiagnostics(cachedMetrics.metrics.files, args.mode, "radon"),
    );
  }
}

function appendPythonMetricsNotes(args: {
  mode: SharedMetricsMode;
  notes: string[];
  runtime: PythonRunnerRuntime;
  stageId: StageResult["stageId"];
  toolRuns: readonly ToolRunResult[];
  totals: PythonMetricsTotals;
  unsupportedFiles: readonly string[];
}): void {
  args.notes.push(
    args.runtime.readSharedMetricsNote(
      "Python",
      args.mode,
      args.totals.scannedFileCount,
      args.totals.totalSloc,
      args.totals.totalBlocks,
      args.totals.maxComplexity,
      args.totals.maxRank,
      args.totals.minMaintainability,
      args.totals.minMaintainabilityRank,
      "functions or classes",
    ),
  );

  if (args.toolRuns.some((toolRun) => toolRun.cacheHit)) {
    args.notes.push("Reused cached Python metrics for this file batch.");
  }

  if (args.unsupportedFiles.length > 0) {
    args.notes.push(
      `Stage '${args.stageId}' is not implemented yet for non-Python files in this selection: ${args.unsupportedFiles.join(", ")}.`,
    );
  }
}

export function readCoverageMetric(
  summary: Record<string, unknown> | undefined,
  ...keys: string[]
): number | undefined {
  if (summary === undefined) {
    return undefined;
  }

  const value = parsers.readNestedValue(summary, keys);
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
