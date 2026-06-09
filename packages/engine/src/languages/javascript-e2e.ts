import type { Diagnostic, PlannedTask, StageResult, ToolRunResult } from "../contracts.js";
import type { JavaScriptRunnerRuntime } from "./contracts.js";
import { runProjectBatches } from "./javascript-batches.js";
import {
  findConfiguredJavaScriptE2eProject,
  resolveJavaScriptE2eRunner,
} from "./javascript-e2e-runner.js";
import { filterJavaScriptTestFiles } from "./javascript-files.js";
import { type JavaScriptE2eProject, resolveJavaScriptE2eProjects } from "./javascript-projects.js";
import { readE2eNote } from "./javascript-reporting.js";

export async function runJavaScriptE2eTask(
  task: PlannedTask,
  runtime: JavaScriptRunnerRuntime,
): Promise<StageResult> {
  const files = filterJavaScriptTestFiles(task.files);
  if (files.length === 0) {
    return runtime.createNoopStageResult(
      task.stageId,
      "No JavaScript or TypeScript project files were selected for e2e.",
    );
  }

  const diagnostics = [] as ReturnType<JavaScriptRunnerRuntime["createProcessFailureDiagnostic"]>[];
  const toolRuns = [] as ReturnType<JavaScriptRunnerRuntime["createToolRunResult"]>[];
  const notes: string[] = [];
  let totalDurationMs = 0;

  try {
    const resolvedProjects = await resolveJavaScriptE2eProjects(runtime.graph, files);
    const projects = await collapseConfiguredJavaScriptE2eProjects(
      resolvedProjects.projects,
      runtime,
    );
    addUnsupportedJavaScriptE2eDiagnostics(
      resolvedProjects.unsupportedFiles,
      runtime,
      diagnostics,
      notes,
    );

    const emptyProjectResult = resolveEmptyJavaScriptE2eResult({
      diagnostics,
      notes,
      projects,
      runtime,
      stageId: task.stageId,
      toolRuns,
      totalDurationMs,
    });
    if (emptyProjectResult !== undefined) {
      return emptyProjectResult;
    }

    const projectResults = await runProjectBatches(projects, async (project) =>
      runJavaScriptE2eProjectTask(project, runtime),
    );

    for (const projectResult of projectResults) {
      totalDurationMs += projectResult.durationMs;
      diagnostics.push(...projectResult.diagnostics);
      notes.push(projectResult.note);
      if (projectResult.toolRun !== undefined) {
        toolRuns.push(projectResult.toolRun);
      }
    }
  } catch (error) {
    runtime.throwIfAbortError(error);
    return runtime.createExecutionFailureStage(
      task.stageId,
      "e2e",
      files[0] ?? runtime.cwd,
      error,
      totalDurationMs,
      diagnostics,
      toolRuns,
    );
  }

  return {
    diagnostics,
    durationMs: totalDurationMs,
    notes,
    stageId: task.stageId,
    status: diagnostics.length > 0 ? "failed" : "passed",
    toolRuns,
  };
}

function addUnsupportedJavaScriptE2eDiagnostics(
  unsupportedFiles: readonly string[],
  runtime: JavaScriptRunnerRuntime,
  diagnostics: ReturnType<JavaScriptRunnerRuntime["createProcessFailureDiagnostic"]>[],
  notes: string[],
): void {
  for (const file of unsupportedFiles) {
    const message =
      "No JavaScript or TypeScript package project was found for e2e. Add package.json plus a Playwright config/tests or an agent-browser/manual-audit script before using AIQ refactoring gates.";
    diagnostics.push(runtime.createProcessFailureDiagnostic(file, "aiq-e2e", message));
    notes.push(message);
  }
}

function resolveEmptyJavaScriptE2eResult(args: {
  diagnostics: Diagnostic[];
  notes: string[];
  projects: readonly JavaScriptE2eProject[];
  runtime: JavaScriptRunnerRuntime;
  stageId: StageResult["stageId"];
  toolRuns: ToolRunResult[];
  totalDurationMs: number;
}): StageResult | undefined {
  if (args.projects.length > 0) {
    return undefined;
  }

  if (args.diagnostics.length > 0) {
    return {
      diagnostics: args.diagnostics,
      durationMs: args.totalDurationMs,
      notes: args.notes,
      stageId: args.stageId,
      status: "failed",
      toolRuns: args.toolRuns,
    };
  }

  return args.runtime.createNoopStageResult(
    args.stageId,
    "No JavaScript or TypeScript package projects were selected for e2e.",
  );
}

async function collapseConfiguredJavaScriptE2eProjects(
  projects: readonly JavaScriptE2eProject[],
  runtime: JavaScriptRunnerRuntime,
): Promise<JavaScriptE2eProject[]> {
  const collapsedProjects = new Map<string, JavaScriptE2eProject>();

  for (const project of projects) {
    const effectiveProject =
      (await findConfiguredJavaScriptE2eProject(project, runtime)) ?? project;
    const existingProject = collapsedProjects.get(effectiveProject.packageJsonPath);
    if (existingProject === undefined) {
      collapsedProjects.set(effectiveProject.packageJsonPath, {
        ...effectiveProject,
        files: [...new Set(project.files)].sort((left, right) => left.localeCompare(right)),
      });
      continue;
    }

    existingProject.files = [...new Set([...existingProject.files, ...project.files])].sort(
      (left, right) => left.localeCompare(right),
    );
  }

  return [...collapsedProjects.values()].sort((left, right) =>
    left.projectRoot.localeCompare(right.projectRoot),
  );
}

async function runJavaScriptE2eProjectTask(
  project: JavaScriptE2eProject,
  runtime: JavaScriptRunnerRuntime,
): Promise<{
  diagnostics: Diagnostic[];
  durationMs: number;
  note: string;
  toolRun?: ToolRunResult;
}> {
  const runner = await resolveJavaScriptE2eRunner(project, runtime);
  if (runner === undefined) {
    const note = `No e2e runner is configured for ${project.projectRoot}. Add Playwright config/tests or an agent-browser/manual-audit script, then run aiq setup if project dependencies are missing.`;
    return {
      diagnostics: [
        runtime.createProcessFailureDiagnostic(project.packageJsonPath, "aiq-e2e", note),
      ],
      durationMs: 0,
      note,
    };
  }

  if (runner.kind === "missing-playwright") {
    return {
      diagnostics: [
        runtime.createProcessFailureDiagnostic(
          project.packageJsonPath,
          runner.name,
          runner.installMessage,
        ),
      ],
      durationMs: 0,
      note: runner.installMessage,
      toolRun: runtime.createToolRunResult(runner.name, [], 0, undefined, "failed"),
    };
  }

  const outcome = await runtime.runExecutable(
    runner.command,
    runner.args,
    project.projectRoot,
    runtime.signal,
  );
  const status = outcome.exitCode === 0 ? "passed" : "failed";
  const diagnostics: Diagnostic[] = [];
  if (status === "failed") {
    diagnostics.push(
      runtime.createProcessFailureDiagnostic(
        project.files[0] ?? project.packageJsonPath,
        runner.name,
        runtime.readProcessFailureMessage(
          runner.name,
          outcome.stderr,
          outcome.stdout,
          outcome.exitCode,
        ),
      ),
    );
  }

  return {
    diagnostics,
    durationMs: outcome.durationMs,
    note: readE2eNote(runner, outcome.stdout, status),
    toolRun: runtime.createToolRunResult(
      runner.name,
      runner.args,
      outcome.durationMs,
      outcome.exitCode,
      status,
      outcome.finishedAt,
      outcome.startedAt,
    ),
  };
}
