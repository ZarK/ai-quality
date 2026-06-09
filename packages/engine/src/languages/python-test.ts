import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { Diagnostic, PlannedTask, StageResult, ToolRunResult } from "../contracts.js";
import * as parsers from "../parsers/index.js";
import type { PythonRunnerRuntime } from "./contracts.js";
import { readCoverageMetric } from "./python-metrics-task.js";
import {
  type PythonProject,
  createPythonProjectExecutionKey,
  filterPythonTaskFiles,
  resolvePythonProjects,
  runProjectBatches,
} from "./python-projects.js";
import { type PythonProjectExecution, executePytestProjectTask } from "./python-tools.js";

export async function runPythonUnitTask(
  task: PlannedTask,
  runtime: PythonRunnerRuntime,
): Promise<StageResult> {
  return runPythonTestStage(task, runtime, "unit");
}

export async function runPythonCoverageTask(
  task: PlannedTask,
  runtime: PythonRunnerRuntime,
): Promise<StageResult> {
  return runPythonTestStage(task, runtime, "coverage");
}

async function runPythonTestStage(
  task: PlannedTask,
  runtime: PythonRunnerRuntime,
  mode: "coverage" | "unit",
): Promise<StageResult> {
  const files = filterPythonTaskFiles(task.files);
  if (files.length === 0) {
    return runtime.createNoopStageResult(
      task.stageId,
      `No Python files were selected for ${task.stageId}.`,
    );
  }

  const diagnostics: Diagnostic[] = [];
  const notes: string[] = [];
  const toolRuns: StageResult["toolRuns"] = [];
  let totalDurationMs = 0;
  const stageTempDir = await mkdtemp(path.join(os.tmpdir(), "aiq-python-stage-"));

  try {
    const projectResults = await runProjectBatches(
      await resolvePythonProjects(runtime.graph, files),
      async (project, projectIndex) =>
        runPythonProjectTestTask(project, runtime, mode, stageTempDir, projectIndex),
    );

    for (const projectResult of projectResults) {
      totalDurationMs += projectResult.durationMs;
      diagnostics.push(...projectResult.diagnostics);
      notes.push(projectResult.note);
      toolRuns.push(projectResult.toolRun);
    }
  } catch (error) {
    runtime.throwIfAbortError(error);
    return runtime.createExecutionFailureStage(
      task.stageId,
      mode === "coverage" ? "pytest-cov" : "pytest",
      files[0] ?? runtime.cwd,
      error,
      totalDurationMs,
      diagnostics,
      toolRuns,
    );
  } finally {
    await rm(stageTempDir, { force: true, recursive: true }).catch(() => undefined);
  }

  return {
    diagnostics,
    durationMs: totalDurationMs,
    notes,
    stageId: task.stageId,
    status: diagnostics.length === 0 ? "passed" : "failed",
    toolRuns,
  };
}

async function runPythonProjectTestTask(
  project: PythonProject,
  runtime: PythonRunnerRuntime,
  mode: "coverage" | "unit",
  stageTempDir: string,
  projectIndex: number,
): Promise<{
  diagnostics: StageResult["diagnostics"];
  durationMs: number;
  note: string;
  toolRun: ToolRunResult;
}> {
  const allowCoverageReuse = canReusePythonCoverage(runtime);
  const cacheKey = createPythonProjectExecutionKey(project);
  const cachedResult = readCachedPythonProjectStageResult(
    runtime,
    mode,
    cacheKey,
    allowCoverageReuse,
  );
  if (cachedResult !== undefined) {
    return cachedResult;
  }

  const preferCoverageExecution = allowCoverageReuse && mode === "unit";
  const preferredMode = preferCoverageExecution ? "coverage" : mode;
  const execution = await executePytestProjectTask(
    project,
    runtime,
    preferredMode,
    stageTempDir,
    projectIndex,
  );

  if (shouldCachePythonProjectExecution(allowCoverageReuse, preferredMode, execution)) {
    runtime.setRunScopedValue("python:test-execution", cacheKey, execution);
  }

  if (shouldFallbackToPlainPythonUnit(preferCoverageExecution, execution)) {
    return materializePythonProjectStageResult(
      await executePytestProjectTask(project, runtime, "unit", stageTempDir, projectIndex),
      "unit",
      false,
    );
  }

  return materializePythonProjectStageResult(execution, mode, false);
}

function canReusePythonCoverage(runtime: PythonRunnerRuntime): boolean {
  return runtime.selectedStages.includes("unit") && runtime.selectedStages.includes("coverage");
}

function readCachedPythonProjectStageResult(
  runtime: PythonRunnerRuntime,
  mode: "coverage" | "unit",
  cacheKey: string,
  allowCoverageReuse: boolean,
): Awaited<ReturnType<typeof runPythonProjectTestTask>> | undefined {
  const cachedExecution = allowCoverageReuse
    ? runtime.getRunScopedValue<PythonProjectExecution>("python:test-execution", cacheKey)
    : undefined;
  return cachedExecution === undefined
    ? undefined
    : materializePythonProjectStageResult(cachedExecution, mode, true);
}

function shouldCachePythonProjectExecution(
  allowCoverageReuse: boolean,
  preferredMode: "coverage" | "unit",
  execution: PythonProjectExecution,
): boolean {
  return (
    allowCoverageReuse &&
    execution.coverageSummaryError === undefined &&
    !isPythonCoverageOnlyFailure(execution) &&
    preferredMode === "coverage"
  );
}

function materializePythonProjectStageResult(
  execution: PythonProjectExecution,
  mode: "coverage" | "unit",
  cacheHit: boolean,
): {
  diagnostics: StageResult["diagnostics"];
  durationMs: number;
  note: string;
  toolRun: ToolRunResult;
} {
  if (mode === "coverage" && execution.coverageSummaryError !== undefined) {
    throw new Error(execution.coverageSummaryError);
  }

  return {
    diagnostics: [...execution.diagnostics],
    durationMs: cacheHit ? 0 : execution.toolRun.durationMs,
    note:
      mode === "coverage"
        ? readPythonCoverageNote(execution.coverageSummary, execution.summary)
        : readPythonUnitNote(execution.summary),
    toolRun: parsers.cloneToolRunResult(execution.toolRun, cacheHit),
  };
}

function shouldFallbackToPlainPythonUnit(
  preferCoverageExecution: boolean,
  execution: PythonProjectExecution,
): boolean {
  return (
    preferCoverageExecution &&
    (execution.coverageSummaryError !== undefined || isPythonCoverageOnlyFailure(execution))
  );
}

function isPythonCoverageOnlyFailure(execution: PythonProjectExecution): boolean {
  return execution.toolRun.status === "failed" && execution.summary.failed === 0;
}

function readPythonUnitNote(summary: { failed: number; passed: number; total: number }): string {
  if (summary.total === 0) {
    return "Pytest found no tests.";
  }

  return `Pytest ran ${summary.total} test${summary.total === 1 ? "" : "s"}: ${summary.passed} passed, ${summary.failed} failed.`;
}

function readPythonCoverageNote(
  coverageSummary: Record<string, unknown> | undefined,
  summary: { failed: number; passed: number; total: number },
): string {
  if (summary.total === 0) {
    return "Pytest found no tests.";
  }

  const totalCoverage = readCoverageMetric(coverageSummary, "totals", "percent_covered");
  if (totalCoverage === undefined) {
    return `Pytest coverage completed after ${summary.total} test${summary.total === 1 ? "" : "s"}.`;
  }

  return `Pytest coverage lines: ${totalCoverage.toFixed(1)}% across ${summary.total} test${summary.total === 1 ? "" : "s"}.`;
}
