import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { Diagnostic, PlannedTask, StageResult, ToolRunResult } from "../contracts.js";
import * as commands from "../tools/command-builders.js";
import { pathExists } from "../utils/path-utils.js";
import type { RustRunnerRuntime } from "./contracts.js";
import { runProjectBatches } from "./rust-batches.js";
import { joinOutputs, normalizeDiagnosticsToSelection } from "./rust-diagnostics.js";
import { type RustProject, filterRustFiles, resolveRustProjects } from "./rust-projects.js";
import {
  createUnsupportedRustRunnerNote,
  isMissingCargoSubcommand,
  parseRustTestReport,
  readLcovLineRate,
  readOptionalTextFile,
  readRustCoverageNote,
  readRustUnitNote,
  resolveRustBinary,
} from "./rust-tools.js";
import { resolveDiagnosticsStatus, resolveUnsupportedSelectionStatus } from "./task-results.js";

type RustTestProcessFailureArgs = [
  status: "failed" | "passed",
  report: ReturnType<typeof parseRustTestReport>,
  project: RustProject,
  mode: "coverage" | "unit",
  outcome: Awaited<ReturnType<RustRunnerRuntime["runExecutable"]>>,
  runtime: RustRunnerRuntime,
  tool: string,
];

export async function runRustUnitTask(
  task: PlannedTask,
  runtime: RustRunnerRuntime,
): Promise<StageResult> {
  return runRustTestStage(task, runtime, "unit");
}

export async function runRustCoverageTask(
  task: PlannedTask,
  runtime: RustRunnerRuntime,
): Promise<StageResult> {
  return runRustTestStage(task, runtime, "coverage");
}

async function runRustTestStage(
  task: PlannedTask,
  runtime: RustRunnerRuntime,
  mode: "coverage" | "unit",
): Promise<StageResult> {
  const files = filterRustFiles(task.files);
  if (files.length === 0) {
    return runtime.createNoopStageResult(
      task.stageId,
      `No Rust files were selected for ${task.stageId}.`,
    );
  }

  const diagnostics: Diagnostic[] = [];
  const notes: string[] = [];
  const toolRuns: ToolRunResult[] = [];
  let totalDurationMs = 0;
  let notImplementedProjectCount = 0;
  let unsupportedFiles: string[] = [];

  try {
    const resolvedProjects = await resolveRustProjects(runtime.graph, files);
    unsupportedFiles = resolvedProjects.unsupportedFiles;

    if (resolvedProjects.projects.length === 0) {
      return runtime.createNotImplementedStageResult(
        task.stageId,
        createUnsupportedRustRunnerNote(task.stageId, unsupportedFiles),
      );
    }

    const projectResults = await runProjectBatches(resolvedProjects.projects, async (project) =>
      runRustProjectTestTask(project, mode, runtime),
    );

    for (const projectResult of projectResults) {
      totalDurationMs += projectResult.durationMs;
      diagnostics.push(...projectResult.diagnostics);
      notes.push(projectResult.note);
      toolRuns.push(projectResult.toolRun);
      notImplementedProjectCount += projectResult.notImplemented ? 1 : 0;
    }
  } catch (error) {
    runtime.throwIfAbortError(error);
    return runtime.createExecutionFailureStage(
      task.stageId,
      mode === "coverage" ? "cargo-llvm-cov" : "cargo-test",
      files[0] ?? runtime.cwd,
      error,
      totalDurationMs,
      diagnostics,
      toolRuns,
    );
  }

  if (unsupportedFiles.length > 0) {
    notes.push(createUnsupportedRustRunnerNote(task.stageId, unsupportedFiles));
  }

  return {
    diagnostics,
    durationMs: totalDurationMs,
    notes,
    stageId: task.stageId,
    status: resolveUnsupportedSelectionStatus({
      diagnosticCount: diagnostics.length,
      notImplementedCount: notImplementedProjectCount,
      unsupportedCount: unsupportedFiles.length,
    }),
    toolRuns,
  };
}

async function runRustProjectTestTask(
  project: RustProject,
  mode: "coverage" | "unit",
  runtime: RustRunnerRuntime,
): Promise<{
  diagnostics: Diagnostic[];
  durationMs: number;
  notImplemented: boolean;
  note: string;
  toolRun: ToolRunResult;
}> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "aiq-rust-runner-"));

  try {
    const lcovPath = path.join(tempDir, "lcov.info");
    const args =
      mode === "coverage"
        ? commands.createCargoLlvmCovArgs({ lcovPath })
        : commands.createCargoTestArgs();
    const tool = mode === "coverage" ? "cargo-llvm-cov" : "cargo-test";
    const outcome = await runtime.runExecutable(
      await resolveRustBinary(runtime),
      args,
      project.projectRoot,
      runtime.signal,
      await runtime.createRustProcessEnv(),
    );
    const report = parseRustTestReport(
      joinOutputs(outcome.stdout, outcome.stderr),
      project.projectRoot,
      tool,
      project.files[0] ?? project.manifestPath,
    );
    if (
      mode === "coverage" &&
      isMissingCargoSubcommand(joinOutputs(outcome.stdout, outcome.stderr), "llvm-cov")
    ) {
      return {
        diagnostics: [],
        durationMs: outcome.durationMs,
        notImplemented: true,
        note: "Rust coverage requires the cargo-llvm-cov subcommand. Install it with `cargo install cargo-llvm-cov` to enable stage 8.",
        toolRun: runtime.createToolRunResult(
          tool,
          args,
          outcome.durationMs,
          outcome.exitCode,
          "not_implemented",
          outcome.finishedAt,
          outcome.startedAt,
        ),
      };
    }
    const coverageResult = await readRustCoverageResult({
      lcovPath,
      mode,
      outcome,
      project,
      report,
      runtime,
      tool,
    });
    const status = resolveRustTestStatus(coverageResult.exitCode, report.diagnostics.length);

    addRustTestProcessFailureDiagnostic(status, report, project, mode, outcome, runtime, tool);

    return {
      diagnostics: report.diagnostics,
      durationMs: outcome.durationMs,
      notImplemented: false,
      note: readRustTestNote(mode, coverageResult.coveragePercent, report.summary),
      toolRun: runtime.createToolRunResult(
        tool,
        args,
        outcome.durationMs,
        coverageResult.exitCode,
        status,
        outcome.finishedAt,
        outcome.startedAt,
      ),
    };
  } finally {
    await rm(tempDir, { force: true, recursive: true }).catch(() => undefined);
  }
}

function resolveRustTestStatus(
  exitCode: number | undefined,
  diagnosticCount: number,
): "failed" | "passed" {
  return exitCode === 0 ? resolveDiagnosticsStatus(diagnosticCount) : "failed";
}

function addRustTestProcessFailureDiagnostic(...input: RustTestProcessFailureArgs): void {
  const [status, report, project, mode, outcome, runtime, tool] = input;
  if (status !== "failed" || report.diagnostics.length > 0) {
    return;
  }

  report.diagnostics.push(
    runtime.createProcessFailureDiagnostic(
      project.files[0] ?? project.manifestPath,
      tool,
      runtime.readProcessFailureMessage(
        mode === "coverage" ? "cargo llvm-cov" : "cargo test",
        outcome.stderr,
        outcome.stdout,
        outcome.exitCode,
      ),
    ),
  );
}

function readRustTestNote(
  mode: "coverage" | "unit",
  coveragePercent: number | undefined,
  summary: ReturnType<typeof parseRustTestReport>["summary"],
): string {
  return mode === "coverage"
    ? readRustCoverageNote(coveragePercent, summary)
    : readRustUnitNote(summary);
}

async function readRustCoverageResult(args: {
  lcovPath: string;
  mode: "coverage" | "unit";
  outcome: Awaited<ReturnType<RustRunnerRuntime["runExecutable"]>>;
  project: RustProject;
  report: ReturnType<typeof parseRustTestReport>;
  runtime: RustRunnerRuntime;
  tool: string;
}): Promise<{ coveragePercent: number | undefined; exitCode: number | undefined }> {
  const base = {
    coveragePercent:
      args.mode === "coverage"
        ? readLcovLineRate(await readOptionalTextFile(args.lcovPath))
        : undefined,
    exitCode: args.outcome.exitCode,
  };
  if (
    args.mode !== "coverage" ||
    args.outcome.exitCode !== 0 ||
    (await pathExists(args.lcovPath))
  ) {
    return base;
  }

  args.report.diagnostics.push(
    args.runtime.createProcessFailureDiagnostic(
      args.project.files[0] ?? args.project.manifestPath,
      args.tool,
      `cargo llvm-cov did not produce coverage report at ${args.lcovPath}.`,
    ),
  );
  return { coveragePercent: undefined, exitCode: 1 };
}
