import type { Diagnostic, PlannedTask, StageResult, ToolRunResult } from "../contracts.js";
import { createFileMetricDiagnostics } from "../metrics-thresholds.js";
import type { DotNetRunnerRuntime, SharedMetricsMode } from "./contracts.js";
import {
  filterDotNetFiles,
  resolveDotNetMetricsFiles,
  resolveDotNetProjects,
  runProjectBatches,
} from "./dotnet-projects.js";
import {
  createUnsupportedDotNetRunnerNote,
  getDotNetMetricsProjectMetrics,
} from "./dotnet-tools.js";
import {
  addSharedFileMetrics,
  createSharedMetricsTotals,
  resolveMetricsStageStatus,
} from "./metrics-accumulator.js";

type DotNetMetricsTotals = ReturnType<typeof createSharedMetricsTotals>;

export async function runDotNetMetricsTask(
  task: PlannedTask,
  runtime: DotNetRunnerRuntime,
  mode: SharedMetricsMode,
): Promise<StageResult> {
  const files = filterDotNetFiles(task.files);
  if (files.length === 0) {
    return runtime.createNoopStageResult(
      task.stageId,
      `No .NET files were selected for ${task.stageId}.`,
    );
  }

  const diagnostics: Diagnostic[] = [];
  const notes: string[] = [];
  const toolRuns: ToolRunResult[] = [];
  let totalDurationMs = 0;
  const totals = createSharedMetricsTotals();
  let unsupportedFiles: string[] = [];

  try {
    unsupportedFiles = await collectDotNetProjectMetrics({
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
      "aiq-csharp-metrics",
      files[0] ?? runtime.cwd,
      error,
      totalDurationMs,
      diagnostics,
      toolRuns,
    );
  }

  appendDotNetMetricsNotes({
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

async function collectDotNetProjectMetrics(args: {
  addDurationMs: (durationMs: number) => void;
  diagnostics: Diagnostic[];
  files: readonly string[];
  mode: SharedMetricsMode;
  runtime: DotNetRunnerRuntime;
  toolRuns: ToolRunResult[];
  totals: DotNetMetricsTotals;
}): Promise<string[]> {
  const resolvedProjects = await resolveDotNetProjects(
    args.runtime.graph,
    args.files,
    "prefer-project",
  );
  const projects = await Promise.all(
    resolvedProjects.projects.map(async (project) => ({
      ...project,
      files: await resolveDotNetMetricsFiles(project),
    })),
  );

  for (const project of projects) {
    if (project.files.length === 0) {
      continue;
    }

    const cachedMetrics = await getDotNetMetricsProjectMetrics(project, args.runtime);
    args.addDurationMs(cachedMetrics.cacheHit ? 0 : cachedMetrics.metrics.durationMs);
    addSharedFileMetrics(args.totals, cachedMetrics.metrics.files);
    args.toolRuns.push(
      args.runtime.createToolRunResult(
        "aiq-csharp-metrics",
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
      ...createFileMetricDiagnostics(cachedMetrics.metrics.files, args.mode, "aiq-csharp-metrics"),
    );
  }

  return resolvedProjects.unsupportedFiles;
}

function appendDotNetMetricsNotes(args: {
  mode: SharedMetricsMode;
  notes: string[];
  runtime: DotNetRunnerRuntime;
  stageId: StageResult["stageId"];
  toolRuns: readonly ToolRunResult[];
  totals: DotNetMetricsTotals;
  unsupportedFiles: readonly string[];
}): void {
  args.notes.push(
    args.runtime.readSharedMetricsNote(
      "C#",
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
    args.notes.push("Reused cached C# metrics for this file batch.");
  }

  if (args.unsupportedFiles.length > 0) {
    args.notes.push(
      `Stage '${args.stageId}' is not implemented yet for non-C# files in this selection: ${args.unsupportedFiles.join(", ")}.`,
    );
  }
}
