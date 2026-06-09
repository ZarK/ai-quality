import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

import type { Diagnostic, ToolRunResult } from "../contracts.js";
import * as parsers from "../parsers/index.js";
import { createJavaScriptTestCommand } from "../tools/node.js";
import type { JavaScriptTestRunner } from "../utils/node-utils.js";
import type { JavaScriptRunnerRuntime } from "./contracts.js";
import type { JavaScriptProject } from "./javascript-projects.js";
import {
  capitalize,
  isValidCoverageSummary,
  isValidJavaScriptTestReport,
  readCoverageNote,
  readJsonFile,
  readTestSummary,
  readUnitNote,
} from "./javascript-reporting.js";
import { resolveDiagnosticsStatus } from "./task-results.js";

type JavaScriptProjectExecution = {
  coverageSummary: Record<string, unknown> | undefined;
  coverageSummaryError: string | undefined;
  diagnostics: Diagnostic[];
  runner: JavaScriptTestRunner;
  summary: {
    failed: number;
    passed: number;
    total: number;
  };
  toolRun: ToolRunResult;
};

export async function runJavaScriptProjectTask(
  project: JavaScriptProject,
  runtime: JavaScriptRunnerRuntime,
  mode: "coverage" | "unit",
  stageTempDir: string,
  projectIndex: number,
): Promise<{
  diagnostics: Diagnostic[];
  durationMs: number;
  note: string;
  toolRun: ToolRunResult;
}> {
  const allowCoverageReuse = canReuseJavaScriptCoverage(runtime);
  const cacheKey = createJavaScriptProjectExecutionKey(project);
  const cachedResult = readCachedJavaScriptProjectStageResult(
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
  const execution = await executeJavaScriptProjectTask(
    project,
    runtime,
    preferredMode,
    stageTempDir,
    projectIndex,
  );

  if (shouldCacheJavaScriptProjectExecution(allowCoverageReuse, preferredMode, execution)) {
    runtime.setRunScopedValue("javascript:test-execution", cacheKey, execution);
  }

  if (shouldFallbackToPlainUnit(preferCoverageExecution, execution)) {
    return materializeJavaScriptProjectStageResult(
      await executeJavaScriptProjectTask(project, runtime, "unit", stageTempDir, projectIndex),
      "unit",
      false,
    );
  }

  return materializeJavaScriptProjectStageResult(execution, mode, false);
}

function canReuseJavaScriptCoverage(runtime: JavaScriptRunnerRuntime): boolean {
  return runtime.selectedStages.includes("unit") && runtime.selectedStages.includes("coverage");
}

function readCachedJavaScriptProjectStageResult(
  runtime: JavaScriptRunnerRuntime,
  mode: "coverage" | "unit",
  cacheKey: string,
  allowCoverageReuse: boolean,
): Awaited<ReturnType<typeof runJavaScriptProjectTask>> | undefined {
  const cachedExecution = allowCoverageReuse
    ? runtime.getRunScopedValue<JavaScriptProjectExecution>("javascript:test-execution", cacheKey)
    : undefined;
  return cachedExecution === undefined
    ? undefined
    : materializeJavaScriptProjectStageResult(cachedExecution, mode, true);
}

function shouldCacheJavaScriptProjectExecution(
  allowCoverageReuse: boolean,
  preferredMode: "coverage" | "unit",
  execution: JavaScriptProjectExecution,
): boolean {
  return (
    allowCoverageReuse &&
    execution.coverageSummaryError === undefined &&
    !isCoverageOnlyFailure(execution) &&
    preferredMode === "coverage"
  );
}

async function executeJavaScriptProjectTask(
  project: JavaScriptProject,
  runtime: JavaScriptRunnerRuntime,
  mode: "coverage" | "unit",
  stageTempDir: string,
  projectIndex: number,
): Promise<JavaScriptProjectExecution> {
  const tempDir = await prepareJavaScriptProjectTempDir(stageTempDir, projectIndex, mode);

  const reportPath = path.join(tempDir, "test-results.json");
  const coverageDirectory = path.join(tempDir, "coverage");
  const command = createJavaScriptTestCommand({
    coverageDirectory,
    executionMode: project.executionMode,
    mode,
    reportPath,
    runner: project.runner,
  });
  const outcome = await runtime.runExecutable(
    command.command,
    command.args,
    project.projectRoot,
    runtime.signal,
  );
  const report = await readJsonFile(reportPath);
  if (outcome.exitCode === 0 && !isValidJavaScriptTestReport(report)) {
    throw new Error(
      `Expected test report at "${reportPath}" for ${project.runner} ${mode} with test summary fields.`,
    );
  }
  const coverageSummary =
    mode === "coverage"
      ? await readJsonFile(path.join(coverageDirectory, "coverage-summary.json"))
      : undefined;
  const diagnostics = parsers.parseTestRunnerDiagnostics(
    report,
    runtime.cwd,
    project.projectRoot,
    project.runner,
  );
  const summary = readTestSummary(report);
  const status = resolveJavaScriptTestStatus(outcome.exitCode, diagnostics.length, summary.failed);

  addJavaScriptTestProcessFailureDiagnostic({
    diagnostics,
    mode,
    outcome,
    project,
    runtime,
    status,
    summary,
  });

  return {
    coverageSummary,
    coverageSummaryError:
      mode === "coverage" && outcome.exitCode === 0 && !isValidCoverageSummary(coverageSummary)
        ? `Expected coverage summary at "${path.join(coverageDirectory, "coverage-summary.json")}" for ${project.runner} coverage with total line coverage.`
        : undefined,
    diagnostics,
    runner: project.runner,
    summary,
    toolRun: runtime.createToolRunResult(
      project.runner,
      command.args,
      outcome.durationMs,
      outcome.exitCode,
      status,
      outcome.finishedAt,
      outcome.startedAt,
    ),
  };
}

function resolveJavaScriptTestStatus(
  exitCode: number | undefined,
  diagnosticCount: number,
  failedTestCount: number,
): "failed" | "passed" {
  if (exitCode !== 0 || failedTestCount > 0) {
    return "failed";
  }

  return resolveDiagnosticsStatus(diagnosticCount);
}

function addJavaScriptTestProcessFailureDiagnostic(args: {
  diagnostics: Diagnostic[];
  mode: "coverage" | "unit";
  outcome: Awaited<ReturnType<JavaScriptRunnerRuntime["runExecutable"]>>;
  project: JavaScriptProject;
  runtime: JavaScriptRunnerRuntime;
  status: "failed" | "passed";
  summary: JavaScriptProjectExecution["summary"];
}): void {
  if (args.status !== "failed" || args.diagnostics.length > 0) {
    return;
  }

  args.diagnostics.push(
    args.runtime.createProcessFailureDiagnostic(
      args.project.files[0] ?? args.project.projectRoot,
      args.project.runner,
      readJavaScriptTestFailureMessage(args),
    ),
  );
}

function readJavaScriptTestFailureMessage(args: {
  mode: "coverage" | "unit";
  outcome: Awaited<ReturnType<JavaScriptRunnerRuntime["runExecutable"]>>;
  project: JavaScriptProject;
  runtime: JavaScriptRunnerRuntime;
  summary: JavaScriptProjectExecution["summary"];
}): string {
  if (args.summary.failed > 0) {
    return `${capitalize(args.project.runner)} reported ${args.summary.failed} failing test${args.summary.failed === 1 ? "" : "s"} in its summary.`;
  }

  return args.runtime.readProcessFailureMessage(
    args.mode === "coverage" ? `${args.project.runner} coverage` : `${args.project.runner} tests`,
    args.outcome.stderr,
    args.outcome.stdout,
    args.outcome.exitCode,
  );
}

async function prepareJavaScriptProjectTempDir(
  stageTempDir: string,
  projectIndex: number,
  mode: "coverage" | "unit",
): Promise<string> {
  const tempDir = path.join(stageTempDir, `project-${projectIndex}-${mode}`);
  await rm(tempDir, { force: true, recursive: true });
  await mkdir(tempDir, { recursive: true });
  return tempDir;
}

function materializeJavaScriptProjectStageResult(
  execution: JavaScriptProjectExecution,
  mode: "coverage" | "unit",
  cacheHit: boolean,
): {
  diagnostics: Diagnostic[];
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
        ? readCoverageNote(execution.runner, execution.coverageSummary, execution.summary)
        : readUnitNote(execution.runner, execution.summary),
    toolRun: parsers.cloneToolRunResult(execution.toolRun, cacheHit),
  };
}

function shouldFallbackToPlainUnit(
  preferCoverageExecution: boolean,
  execution: JavaScriptProjectExecution,
): boolean {
  return (
    preferCoverageExecution &&
    (execution.coverageSummaryError !== undefined || isCoverageOnlyFailure(execution))
  );
}

function isCoverageOnlyFailure(execution: JavaScriptProjectExecution): boolean {
  return execution.toolRun.status === "failed" && execution.summary.failed === 0;
}

function createJavaScriptProjectExecutionKey(project: JavaScriptProject): string {
  return `${project.runner}:${project.projectRoot}:${[...project.files].sort().join("|")}`;
}
