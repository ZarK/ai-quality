import type { Diagnostic, PlannedTask, StageResult, ToolRunResult } from "../contracts.js";
import type { DotNetRunnerRuntime } from "./contracts.js";
import { filterDotNetFiles, resolveDotNetProjects, runProjectBatches } from "./dotnet-projects.js";
import { createUnsupportedDotNetRunnerNote, runDotNetProjectTestTask } from "./dotnet-tools.js";

export async function runDotNetUnitTask(
  task: PlannedTask,
  runtime: DotNetRunnerRuntime,
): Promise<StageResult> {
  return runDotNetTestStage(task, runtime, "unit");
}

export async function runDotNetCoverageTask(
  task: PlannedTask,
  runtime: DotNetRunnerRuntime,
): Promise<StageResult> {
  return runDotNetTestStage(task, runtime, "coverage");
}

async function runDotNetTestStage(
  task: PlannedTask,
  runtime: DotNetRunnerRuntime,
  mode: "coverage" | "unit",
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
  let unsupportedFiles: string[] = [];

  try {
    const resolvedProjects = await resolveDotNetTestProjects(files, runtime);
    unsupportedFiles = resolvedProjects.unsupportedFiles;
    if (resolvedProjects.stageResult !== undefined) {
      return resolvedProjects.stageResult(task.stageId);
    }
    totalDurationMs += await collectDotNetTestProjectResults(
      resolvedProjects.projects,
      mode,
      runtime,
      diagnostics,
      notes,
      toolRuns,
    );
  } catch (error) {
    runtime.throwIfAbortError(error);
    return runtime.createExecutionFailureStage(
      task.stageId,
      mode === "coverage" ? "dotnet-test-coverage" : "dotnet-test",
      files[0] ?? runtime.cwd,
      error,
      totalDurationMs,
      diagnostics,
      toolRuns,
    );
  }

  if (unsupportedFiles.length > 0) {
    notes.push(createUnsupportedDotNetRunnerNote(task.stageId, unsupportedFiles));
  }

  return {
    diagnostics,
    durationMs: totalDurationMs,
    notes,
    stageId: task.stageId,
    status: resolveDotNetTestStatus(diagnostics.length, unsupportedFiles.length),
    toolRuns,
  };
}

async function resolveDotNetTestProjects(
  files: readonly string[],
  runtime: DotNetRunnerRuntime,
): Promise<{
  projects: Awaited<ReturnType<typeof resolveDotNetProjects>>["projects"];
  stageResult?: (stageId: StageResult["stageId"]) => StageResult;
  unsupportedFiles: string[];
}> {
  const resolvedProjects = await resolveDotNetProjects(runtime.graph, files, "prefer-solution");
  if (resolvedProjects.projects.length === 0) {
    return {
      projects: [],
      stageResult: (stageId) =>
        runtime.createNotImplementedStageResult(
          stageId,
          createUnsupportedDotNetRunnerNote(stageId, resolvedProjects.unsupportedFiles),
        ),
      unsupportedFiles: resolvedProjects.unsupportedFiles,
    };
  }

  return resolvedProjects;
}

async function collectDotNetTestProjectResults(
  projects: Awaited<ReturnType<typeof resolveDotNetProjects>>["projects"],
  mode: "coverage" | "unit",
  runtime: DotNetRunnerRuntime,
  diagnostics: Diagnostic[],
  notes: string[],
  toolRuns: ToolRunResult[],
): Promise<number> {
  let durationMs = 0;
  const projectResults = await runProjectBatches(
    projects,
    async (project) => runDotNetProjectTestTask(project, mode, runtime),
    1,
  );

  for (const projectResult of projectResults) {
    durationMs += projectResult.durationMs;
    diagnostics.push(...projectResult.diagnostics);
    notes.push(projectResult.note);
    toolRuns.push(projectResult.toolRun);
  }

  return durationMs;
}

function resolveDotNetTestStatus(
  diagnosticCount: number,
  unsupportedFileCount: number,
): StageResult["status"] {
  if (diagnosticCount > 0) {
    return "failed";
  }

  return unsupportedFileCount > 0 ? "not_implemented" : "passed";
}
