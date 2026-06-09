import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { Diagnostic, PlannedTask, StageResult, ToolRunResult } from "../contracts.js";
import * as parsers from "../parsers/index.js";
import { pathExists } from "../utils/path-utils.js";
import type { JvmRunnerRuntime } from "./contracts.js";
import {
  type JvmProject,
  filterJvmFiles,
  resolveJvmProjects,
  runProjectBatches,
} from "./jvm-projects.js";
import {
  createUnsupportedJvmRunnerNote,
  findJvmCoverageReport,
  findJvmJunitReports,
  parseJvmCompilerDiagnostics,
  readJacocoLineRate,
  readJvmCoverageNote,
  readJvmUnitNote,
  resolveJvmExecutionCommand,
} from "./jvm-tools.js";
import { resolveUnsupportedSelectionStatus } from "./task-results.js";

type JvmBuildMode = "coverage" | "typecheck" | "unit";
type JvmExecutionCommand = NonNullable<Awaited<ReturnType<typeof resolveJvmExecutionCommand>>>;

export async function runJvmTypecheckTask(
  task: PlannedTask,
  runtime: JvmRunnerRuntime,
): Promise<StageResult> {
  const files = filterJvmFiles(task.files);
  if (files.length === 0) {
    return runtime.createNoopStageResult(task.stageId, "No JVM files were selected for typecheck.");
  }

  const diagnostics: Diagnostic[] = [];
  const notes: string[] = [];
  const toolRuns: ToolRunResult[] = [];
  let totalDurationMs = 0;
  let unsupportedFiles: string[] = [];
  let notImplementedProjectCount = 0;

  try {
    const resolvedProjects = await resolveJvmProjects(runtime.graph, files);
    unsupportedFiles = resolvedProjects.unsupportedFiles;

    if (resolvedProjects.projects.length === 0) {
      return runtime.createNotImplementedStageResult(
        task.stageId,
        createUnsupportedJvmRunnerNote(task.stageId, unsupportedFiles),
      );
    }

    const projectResults = await runProjectBatches(resolvedProjects.projects, async (project) =>
      runJvmBuildProjectTask(project, "typecheck", runtime),
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
      "jvm-build",
      files[0] ?? runtime.cwd,
      error,
      totalDurationMs,
      diagnostics,
      toolRuns,
    );
  }

  if (unsupportedFiles.length > 0) {
    notes.push(createUnsupportedJvmRunnerNote(task.stageId, unsupportedFiles));
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

export async function runJvmUnitTask(
  task: PlannedTask,
  runtime: JvmRunnerRuntime,
): Promise<StageResult> {
  return runJvmTestStage(task, runtime, "unit");
}

export async function runJvmCoverageTask(
  task: PlannedTask,
  runtime: JvmRunnerRuntime,
): Promise<StageResult> {
  return runJvmTestStage(task, runtime, "coverage");
}

async function runJvmTestStage(
  task: PlannedTask,
  runtime: JvmRunnerRuntime,
  mode: "coverage" | "unit",
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
  let unsupportedFiles: string[] = [];
  let notImplementedProjectCount = 0;

  try {
    const resolvedProjects = await resolveJvmProjects(runtime.graph, files);
    unsupportedFiles = resolvedProjects.unsupportedFiles;

    if (resolvedProjects.projects.length === 0) {
      return runtime.createNotImplementedStageResult(
        task.stageId,
        createUnsupportedJvmRunnerNote(task.stageId, unsupportedFiles),
      );
    }

    const projectResults = await runProjectBatches(
      resolvedProjects.projects,
      async (project) => runJvmBuildProjectTask(project, mode, runtime),
      1,
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
      mode === "coverage" ? "jvm-test-coverage" : "jvm-test",
      files[0] ?? runtime.cwd,
      error,
      totalDurationMs,
      diagnostics,
      toolRuns,
    );
  }

  if (unsupportedFiles.length > 0) {
    notes.push(createUnsupportedJvmRunnerNote(task.stageId, unsupportedFiles));
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

async function runJvmBuildProjectTask(
  project: JvmProject,
  mode: JvmBuildMode,
  runtime: JvmRunnerRuntime,
): Promise<{
  diagnostics: Diagnostic[];
  durationMs: number;
  notImplemented: boolean;
  note: string;
  toolRun: ToolRunResult;
}> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "aiq-jvm-runner-"));

  try {
    const command = await resolveJvmExecutionCommand(project, mode, tempDir, runtime);
    if (command === undefined) {
      return {
        diagnostics: [],
        durationMs: 0,
        notImplemented: true,
        note: `No supported JVM ${mode} command was detected for ${project.projectRoot}.`,
        toolRun: runtime.createToolRunResult(
          "jvm-unavailable",
          [],
          0,
          undefined,
          "not_implemented",
        ),
      };
    }

    const outcome = await runtime.runExecutable(
      command.command,
      command.args,
      project.projectRoot,
      runtime.signal,
      command.env,
    );
    const report = await readJvmBuildReport(mode, project, tempDir, runtime);
    const coveragePercent = await readJvmBuildCoveragePercent(mode, project, tempDir, runtime);
    const parsedDiagnostics = readJvmBuildDiagnostics(mode, outcome, report, project, command);
    addJvmBuildProcessFailureDiagnostic(parsedDiagnostics, outcome, project, command, runtime);

    return {
      diagnostics: parsedDiagnostics,
      durationMs: outcome.durationMs,
      notImplemented: false,
      note: readJvmBuildProjectNote({
        coveragePercent,
        diagnosticCount: parsedDiagnostics.length,
        label: command.label,
        mode,
        project,
        summary: report?.summary ?? { failed: 0, passed: 0, total: 0 },
      }),
      toolRun: runtime.createToolRunResult(
        command.tool,
        command.args,
        outcome.durationMs,
        outcome.exitCode,
        parsedDiagnostics.length === 0 ? "passed" : "failed",
        outcome.finishedAt,
        outcome.startedAt,
      ),
    };
  } finally {
    await rm(tempDir, { force: true, recursive: true }).catch(() => undefined);
  }
}

async function readJvmBuildReport(
  mode: JvmBuildMode,
  project: JvmProject,
  tempDir: string,
  runtime: JvmRunnerRuntime,
): Promise<Awaited<ReturnType<typeof parsers.parseJvmJunitReports>> | undefined> {
  if (mode === "typecheck") {
    return undefined;
  }

  return parsers.parseJvmJunitReports(
    await findJvmJunitReports(project, tempDir, runtime),
    project.files[0] ?? project.buildFilePath,
    readOptionalTextFile,
  );
}

async function readJvmBuildCoveragePercent(
  mode: JvmBuildMode,
  project: JvmProject,
  tempDir: string,
  runtime: JvmRunnerRuntime,
): Promise<number | undefined> {
  if (mode !== "coverage") {
    return undefined;
  }

  return readJacocoLineRate(
    await readOptionalTextFile(await findJvmCoverageReport(project, tempDir, runtime)),
  );
}

function readJvmBuildDiagnostics(
  mode: JvmBuildMode,
  outcome: Awaited<ReturnType<JvmRunnerRuntime["runExecutable"]>>,
  report: Awaited<ReturnType<typeof parsers.parseJvmJunitReports>> | undefined,
  project: JvmProject,
  command: JvmExecutionCommand,
): Diagnostic[] {
  if (mode !== "typecheck") {
    return report?.diagnostics ?? [];
  }

  return parseJvmCompilerDiagnostics(
    joinOutputs(outcome.stdout, outcome.stderr),
    project.projectRoot,
    command.tool,
  );
}

function addJvmBuildProcessFailureDiagnostic(
  diagnostics: Diagnostic[],
  outcome: Awaited<ReturnType<JvmRunnerRuntime["runExecutable"]>>,
  project: JvmProject,
  command: JvmExecutionCommand,
  runtime: JvmRunnerRuntime,
): void {
  if (outcome.exitCode === 0 || diagnostics.length > 0) {
    return;
  }

  diagnostics.push(
    runtime.createProcessFailureDiagnostic(
      project.files[0] ?? project.buildFilePath,
      command.tool,
      runtime.readProcessFailureMessage(
        command.label,
        outcome.stderr,
        outcome.stdout,
        outcome.exitCode,
      ),
    ),
  );
}

function readJvmBuildProjectNote(args: {
  coveragePercent: number | undefined;
  diagnosticCount: number;
  label: string;
  mode: JvmBuildMode;
  project: JvmProject;
  summary: { failed: number; passed: number; total: number };
}): string {
  if (args.mode === "typecheck") {
    return readJvmTypecheckNote(args.label, args.project.projectRoot, args.diagnosticCount);
  }
  if (args.mode === "coverage") {
    return readJvmCoverageNote(args.project.buildSystem, args.summary, args.coveragePercent);
  }
  return readJvmUnitNote(args.project.buildSystem, args.summary);
}

function readJvmTypecheckNote(label: string, projectRoot: string, diagnosticCount: number): string {
  if (diagnosticCount === 0) {
    return `${label} passed for ${path.basename(projectRoot)}.`;
  }

  return `${label} reported ${diagnosticCount} diagnostic${diagnosticCount === 1 ? "" : "s"} for ${path.basename(projectRoot)}.`;
}

function joinOutputs(...values: string[]): string {
  return values.filter((value) => value.length > 0).join("\n");
}

async function readOptionalTextFile(filePath: string | undefined): Promise<string | undefined> {
  if (filePath === undefined || !(await pathExists(filePath))) {
    return undefined;
  }

  return readFile(filePath, "utf8");
}
