import path from "node:path";

import type { Diagnostic, PlannedTask, StageResult, ToolRunResult } from "../contracts.js";
import type { JvmRunnerRuntime } from "./contracts.js";
import {
  type JvmProject,
  filterJvmFiles,
  jvmSourceExtensions,
  resolveJvmProjects,
  runProjectBatches,
} from "./jvm-projects.js";
import {
  createUnsupportedJvmRunnerNote,
  parseJvmCompilerDiagnostics,
  resolveJvmLintOrFormatCommand,
} from "./jvm-tools.js";
import { resolveUnsupportedSelectionStatus } from "./task-results.js";

export async function runJvmLintTask(
  task: PlannedTask,
  runtime: JvmRunnerRuntime,
): Promise<StageResult> {
  return runJvmStageTask(task, runtime, "lint");
}

export async function runJvmFormatTask(
  task: PlannedTask,
  runtime: JvmRunnerRuntime,
): Promise<StageResult> {
  return runJvmStageTask(task, runtime, "format");
}

async function runJvmStageTask(
  task: PlannedTask,
  runtime: JvmRunnerRuntime,
  mode: "format" | "lint",
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

    const projectResults = await runProjectBatches(resolvedProjects.projects, async (project) =>
      runJvmLintOrFormatProjectTask(project, mode, runtime),
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
      mode === "format" ? "jvm-format" : "jvm-lint",
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

async function runJvmLintOrFormatProjectTask(
  project: JvmProject,
  mode: "format" | "lint",
  runtime: JvmRunnerRuntime,
): Promise<{
  diagnostics: Diagnostic[];
  durationMs: number;
  notImplemented: boolean;
  note: string;
  toolRun: ToolRunResult;
}> {
  const command = await resolveJvmLintOrFormatCommand(project, mode, runtime);
  if (command === undefined) {
    return {
      diagnostics: [],
      durationMs: 0,
      notImplemented: true,
      note: `No supported JVM ${mode} command was detected for ${project.projectRoot}.`,
      toolRun: runtime.createToolRunResult("jvm-unavailable", [], 0, undefined, "not_implemented"),
    };
  }

  const outcome = await runtime.runExecutable(
    command.command,
    command.args,
    project.projectRoot,
    runtime.signal,
    command.env,
  );
  const diagnostics =
    outcome.exitCode === 0
      ? []
      : [
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
        ];

  return {
    diagnostics,
    durationMs: outcome.durationMs,
    notImplemented: false,
    note:
      diagnostics.length === 0
        ? `${command.label} passed for ${path.basename(project.projectRoot)}.`
        : `${command.label} reported ${diagnostics.length} diagnostic${diagnostics.length === 1 ? "" : "s"} for ${path.basename(project.projectRoot)}.`,
    toolRun: runtime.createToolRunResult(
      command.tool,
      command.args,
      outcome.durationMs,
      outcome.exitCode,
      diagnostics.length === 0 ? "passed" : "failed",
      outcome.finishedAt,
      outcome.startedAt,
    ),
  };
}
