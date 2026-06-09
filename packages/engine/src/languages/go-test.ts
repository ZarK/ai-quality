import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { Diagnostic, PlannedTask, StageResult, ToolRunResult } from "../contracts.js";
import * as commands from "../tools/command-builders.js";
import type { GoRunnerRuntime } from "./contracts.js";
import { runProjectBatches } from "./go-batches.js";
import { joinOutputs, normalizeDiagnosticsToSelection } from "./go-diagnostics.js";
import { type GoProject, filterGoFiles, findFileExists, resolveGoProjects } from "./go-projects.js";
import {
  createUnsupportedGoRunnerNote,
  parseGoCoveragePercent,
  parseGoTestReport,
  readGoCoverageNote,
  readGoUnitNote,
  resolveGoBinary,
} from "./go-tools.js";
import { resolveDiagnosticsStatus, resolveUnsupportedSelectionStatus } from "./task-results.js";

export async function runGoUnitTask(
  task: PlannedTask,
  runtime: GoRunnerRuntime,
): Promise<StageResult> {
  return runGoTestStage(task, runtime, "unit");
}

export async function runGoCoverageTask(
  task: PlannedTask,
  runtime: GoRunnerRuntime,
): Promise<StageResult> {
  return runGoTestStage(task, runtime, "coverage");
}

async function runGoTestStage(
  task: PlannedTask,
  runtime: GoRunnerRuntime,
  mode: "coverage" | "unit",
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
  let unsupportedFiles: string[] = [];

  try {
    const resolvedProjects = await resolveGoProjects(runtime.graph, files);
    unsupportedFiles = resolvedProjects.unsupportedFiles;

    if (resolvedProjects.projects.length === 0) {
      return runtime.createNotImplementedStageResult(
        task.stageId,
        createUnsupportedGoRunnerNote(task.stageId, unsupportedFiles),
      );
    }

    const projectResults = await runProjectBatches(resolvedProjects.projects, async (project) =>
      runGoProjectTestTask(project, mode, runtime),
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
      mode === "coverage" ? "go-test-coverage" : "go-test",
      files[0] ?? runtime.cwd,
      error,
      totalDurationMs,
      diagnostics,
      toolRuns,
    );
  }

  if (unsupportedFiles.length > 0) {
    notes.push(createUnsupportedGoRunnerNote(task.stageId, unsupportedFiles));
  }

  return {
    diagnostics,
    durationMs: totalDurationMs,
    notes,
    stageId: task.stageId,
    status: resolveUnsupportedSelectionStatus({
      diagnosticCount: diagnostics.length,
      unsupportedCount: unsupportedFiles.length,
    }),
    toolRuns,
  };
}

async function runGoProjectTestTask(
  project: GoProject,
  mode: "coverage" | "unit",
  runtime: GoRunnerRuntime,
): Promise<{
  diagnostics: Diagnostic[];
  durationMs: number;
  note: string;
  toolRun: ToolRunResult;
}> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "aiq-go-runner-"));

  try {
    const coveragePath = path.join(tempDir, "coverage.out");
    const args = commands.createGoTestArgs(
      mode === "coverage" ? { coverageProfile: coveragePath } : {},
    );
    const goCommand = await resolveGoBinary("go", runtime);
    const outcome = await runtime.runExecutable(
      goCommand,
      args,
      project.projectRoot,
      runtime.signal,
    );
    const report = parseGoTestReport(
      outcome.stdout,
      project.projectRoot,
      mode === "coverage" ? "go-test-coverage" : "go-test",
      project.files[0] ?? project.moduleFilePath,
    );
    const toolArgs = [...args];
    const coverageResult = await readGoCoverageResult({
      coveragePath,
      goCommand,
      mode,
      outcome,
      project,
      report,
      runtime,
      toolArgs,
    });
    const status = resolveGoTestStatus(coverageResult.exitCode, report.diagnostics.length);

    addGoTestProcessFailureDiagnostic(status, report, project, mode, outcome, runtime);

    return {
      diagnostics: report.diagnostics,
      durationMs: coverageResult.durationMs,
      note: readGoTestNote(mode, coverageResult.coveragePercent, report.summary),
      toolRun: runtime.createToolRunResult(
        mode === "coverage" ? "go-test-coverage" : "go-test",
        toolArgs,
        coverageResult.durationMs,
        coverageResult.exitCode,
        status,
        coverageResult.finishedAt,
        outcome.startedAt,
      ),
    };
  } finally {
    await rm(tempDir, { force: true, recursive: true }).catch(() => undefined);
  }
}

function resolveGoTestStatus(
  exitCode: number | undefined,
  diagnosticCount: number,
): "failed" | "passed" {
  return exitCode === 0 ? resolveDiagnosticsStatus(diagnosticCount) : "failed";
}

function addGoTestProcessFailureDiagnostic(
  status: "failed" | "passed",
  report: ReturnType<typeof parseGoTestReport>,
  project: GoProject,
  mode: "coverage" | "unit",
  outcome: Awaited<ReturnType<GoRunnerRuntime["runExecutable"]>>,
  runtime: GoRunnerRuntime,
): void {
  if (status !== "failed" || report.diagnostics.length > 0) {
    return;
  }

  report.diagnostics.push(
    runtime.createProcessFailureDiagnostic(
      project.files[0] ?? project.moduleFilePath,
      mode === "coverage" ? "go-test-coverage" : "go-test",
      runtime.readProcessFailureMessage(
        "go test",
        outcome.stderr,
        outcome.stdout,
        outcome.exitCode,
      ),
    ),
  );
}

function readGoTestNote(
  mode: "coverage" | "unit",
  coveragePercent: number | undefined,
  summary: ReturnType<typeof parseGoTestReport>["summary"],
): string {
  return mode === "coverage"
    ? readGoCoverageNote(coveragePercent, summary)
    : readGoUnitNote(summary);
}

async function readGoCoverageResult(args: {
  coveragePath: string;
  goCommand: string;
  mode: "coverage" | "unit";
  outcome: Awaited<ReturnType<GoRunnerRuntime["runExecutable"]>>;
  project: GoProject;
  report: ReturnType<typeof parseGoTestReport>;
  runtime: GoRunnerRuntime;
  toolArgs: string[];
}): Promise<{
  coveragePercent: number | undefined;
  durationMs: number;
  exitCode: number | undefined;
  finishedAt: string;
}> {
  const base = {
    coveragePercent: undefined,
    durationMs: args.outcome.durationMs,
    exitCode: args.outcome.exitCode,
    finishedAt: args.outcome.finishedAt,
  };
  if (args.mode !== "coverage") {
    return base;
  }

  if (await findFileExists(args.coveragePath)) {
    return runGoCoverageSummary(args, base);
  }

  return handleMissingGoCoverageProfile(args, base);
}

async function runGoCoverageSummary(
  args: Parameters<typeof readGoCoverageResult>[0],
  base: Awaited<ReturnType<typeof readGoCoverageResult>>,
) {
  const coverageArgs = commands.createGoCoverageArgs({ func: args.coveragePath });
  const coverageOutcome = await args.runtime.runExecutable(
    args.goCommand,
    coverageArgs,
    args.project.projectRoot,
    args.runtime.signal,
  );
  args.toolArgs.push(...coverageArgs);

  if (coverageOutcome.exitCode === 0) {
    return {
      ...base,
      coveragePercent: parseGoCoveragePercent(coverageOutcome.stdout),
      durationMs: base.durationMs + coverageOutcome.durationMs,
      finishedAt: coverageOutcome.finishedAt,
    };
  }

  args.report.diagnostics.push(
    args.runtime.createProcessFailureDiagnostic(
      args.project.files[0] ?? args.project.moduleFilePath,
      "go-tool-cover",
      args.runtime.readProcessFailureMessage(
        "go tool cover",
        coverageOutcome.stderr,
        coverageOutcome.stdout,
        coverageOutcome.exitCode,
      ),
    ),
  );
  return {
    ...base,
    durationMs: base.durationMs + coverageOutcome.durationMs,
    exitCode: coverageOutcome.exitCode,
    finishedAt: coverageOutcome.finishedAt,
  };
}

function handleMissingGoCoverageProfile(
  args: Parameters<typeof readGoCoverageResult>[0],
  base: Awaited<ReturnType<typeof readGoCoverageResult>>,
) {
  if (args.outcome.exitCode !== 0) {
    return base;
  }

  args.report.diagnostics.push(
    args.runtime.createProcessFailureDiagnostic(
      args.project.files[0] ?? args.project.moduleFilePath,
      "go-test-coverage",
      `go test did not produce coverage profile at ${args.coveragePath}.`,
    ),
  );
  return { ...base, exitCode: 1 };
}
