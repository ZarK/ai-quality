import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { Diagnostic, PlannedTask, StageResult, ToolRunResult } from "../contracts.js";
import type { JavaScriptRunnerRuntime } from "./contracts.js";
import { runProjectBatches } from "./javascript-batches.js";
import { filterJavaScriptTestFiles } from "./javascript-files.js";
import { type JavaScriptProject, resolveJavaScriptProjects } from "./javascript-projects.js";
import { runJavaScriptProjectTask } from "./javascript-test-execution.js";

export async function runJavaScriptUnitTask(
  task: PlannedTask,
  runtime: JavaScriptRunnerRuntime,
): Promise<StageResult> {
  return runJavaScriptTestStage(task, runtime, "unit");
}

export async function runJavaScriptCoverageTask(
  task: PlannedTask,
  runtime: JavaScriptRunnerRuntime,
): Promise<StageResult> {
  return runJavaScriptTestStage(task, runtime, "coverage");
}

async function runJavaScriptTestStage(
  task: PlannedTask,
  runtime: JavaScriptRunnerRuntime,
  mode: "coverage" | "unit",
): Promise<StageResult> {
  const files = filterJavaScriptTestFiles(task.files);
  if (files.length === 0) {
    return runtime.createNoopStageResult(
      task.stageId,
      `No JavaScript or TypeScript files were selected for ${task.stageId}.`,
    );
  }

  const diagnostics = [] as ReturnType<JavaScriptRunnerRuntime["createProcessFailureDiagnostic"]>[];
  const toolRuns = [] as ReturnType<JavaScriptRunnerRuntime["createToolRunResult"]>[];
  const notes: string[] = [];
  let totalDurationMs = 0;
  let unsupportedProjectRoots: string[] = [];
  const stageTempDir = await mkdtemp(path.join(os.tmpdir(), "aiq-js-stage-"));

  try {
    const resolvedProjects = await resolveJavaScriptTestProjects(files, runtime);
    unsupportedProjectRoots = resolvedProjects.unsupportedProjectRoots;
    if (resolvedProjects.stageResult !== undefined) {
      return resolvedProjects.stageResult(task.stageId);
    }

    totalDurationMs += await collectJavaScriptProjectStageResults({
      diagnostics,
      mode,
      notes,
      projects: resolvedProjects.projects,
      runtime,
      stageTempDir,
      toolRuns,
    });
  } catch (error) {
    runtime.throwIfAbortError(error);
    return runtime.createExecutionFailureStage(
      task.stageId,
      mode === "coverage" ? "test-coverage" : "test-runner",
      files[0] ?? runtime.cwd,
      error,
      totalDurationMs,
      diagnostics,
      toolRuns,
    );
  } finally {
    await rm(stageTempDir, { force: true, recursive: true }).catch(() => undefined);
  }

  if (unsupportedProjectRoots.length > 0) {
    notes.push(runtime.readUnsupportedRunnerNote(task.stageId, unsupportedProjectRoots));
  }

  return {
    diagnostics,
    durationMs: totalDurationMs,
    notes,
    stageId: task.stageId,
    status: resolveJavaScriptStageStatus(diagnostics.length),
    toolRuns,
  };
}

async function resolveJavaScriptTestProjects(
  files: readonly string[],
  runtime: JavaScriptRunnerRuntime,
): Promise<{
  projects: Awaited<ReturnType<typeof resolveJavaScriptProjects>>["projects"];
  stageResult?: (stageId: StageResult["stageId"]) => StageResult;
  unsupportedProjectRoots: string[];
}> {
  const resolvedProjects = await resolveJavaScriptProjects(runtime.graph, files);
  if (resolvedProjects.projects.length === 0) {
    return {
      projects: [],
      stageResult: (stageId) =>
        runtime.createNotImplementedStageResult(
          stageId,
          runtime.readUnsupportedRunnerNote(stageId, resolvedProjects.unsupportedProjectRoots),
        ),
      unsupportedProjectRoots: resolvedProjects.unsupportedProjectRoots,
    };
  }

  return resolvedProjects;
}

async function collectJavaScriptProjectStageResults(args: {
  diagnostics: Diagnostic[];
  mode: "coverage" | "unit";
  notes: string[];
  projects: Awaited<ReturnType<typeof resolveJavaScriptProjects>>["projects"];
  runtime: JavaScriptRunnerRuntime;
  stageTempDir: string;
  toolRuns: ToolRunResult[];
}): Promise<number> {
  let durationMs = 0;
  const projectResults = await runProjectBatches(args.projects, async (project, projectIndex) =>
    runJavaScriptProjectTask(project, args.runtime, args.mode, args.stageTempDir, projectIndex),
  );

  for (const projectResult of projectResults) {
    durationMs += projectResult.durationMs;
    args.diagnostics.push(...projectResult.diagnostics);
    args.notes.push(projectResult.note);
    args.toolRuns.push(projectResult.toolRun);
  }

  return durationMs;
}

function resolveJavaScriptStageStatus(diagnosticCount: number): StageResult["status"] {
  return diagnosticCount > 0 ? "failed" : "passed";
}
