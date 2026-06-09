import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { Diagnostic, PlannedTask, StageResult } from "../contracts.js";
import { createLizardMetricsDiagnostics } from "../metrics-thresholds.js";
import * as parsers from "../parsers/index.js";
import type { LizardMetricsFileMetrics } from "../parsers/lizard.js";
import * as commands from "../tools/command-builders.js";
import { findNearestLizardConfig, readConfigFingerprint } from "../tools/native-config.js";
import type { JavaScriptRunnerRuntime, SharedMetricsMode } from "./contracts.js";
import { filterJavaScriptMetricsFiles } from "./javascript-files.js";
import {
  type JavaScriptMetricsProject,
  resolveJavaScriptMetricsFiles,
  resolveJavaScriptMetricsProjects,
} from "./javascript-projects.js";
import {
  addSharedFileMetrics,
  createSharedMetricsTotals,
  resolveMetricsStageStatus,
} from "./metrics-accumulator.js";

type JavaScriptMetricsTotals = ReturnType<typeof createSharedMetricsTotals>;

type JavaScriptMetricsProjectMetrics = {
  args: string[];
  durationMs: number;
  exitCode: number | undefined;
  files: Record<string, LizardMetricsFileMetrics>;
  finishedAt: string;
  startedAt: string;
};

export async function runJavaScriptMetricsTask(
  task: PlannedTask,
  runtime: JavaScriptRunnerRuntime,
  mode: SharedMetricsMode,
): Promise<StageResult> {
  const files = filterJavaScriptMetricsFiles(task.files);
  if (files.length === 0) {
    return runtime.createNoopStageResult(
      task.stageId,
      `No JavaScript or TypeScript files were selected for ${task.stageId}.`,
    );
  }

  const diagnostics: Diagnostic[] = [];
  const notes: string[] = [];
  const toolRuns = [] as ReturnType<JavaScriptRunnerRuntime["createToolRunResult"]>[];
  let totalDurationMs = 0;
  const totals = createSharedMetricsTotals();
  let unsupportedFiles: string[] = [];

  try {
    unsupportedFiles = await collectJavaScriptProjectMetrics({
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
      "lizard",
      files[0] ?? runtime.cwd,
      error,
      totalDurationMs,
      diagnostics,
      toolRuns,
    );
  }

  appendJavaScriptMetricsNotes({
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

async function collectJavaScriptProjectMetrics(args: {
  addDurationMs: (durationMs: number) => void;
  diagnostics: Diagnostic[];
  files: readonly string[];
  mode: SharedMetricsMode;
  runtime: JavaScriptRunnerRuntime;
  toolRuns: ReturnType<JavaScriptRunnerRuntime["createToolRunResult"]>[];
  totals: JavaScriptMetricsTotals;
}): Promise<string[]> {
  const resolvedProjects = await resolveJavaScriptMetricsProjects(args.runtime.graph, args.files);
  const projects = await Promise.all(
    resolvedProjects.projects.map(async (project) => ({
      ...project,
      files: await resolveJavaScriptMetricsFiles(project, args.runtime),
    })),
  );

  for (const project of projects) {
    if (project.files.length === 0) {
      continue;
    }

    const cachedMetrics = await getJavaScriptMetricsProjectMetrics(project, args.runtime);
    args.addDurationMs(cachedMetrics.cacheHit ? 0 : cachedMetrics.metrics.durationMs);
    addSharedFileMetrics(args.totals, cachedMetrics.metrics.files);
    args.toolRuns.push(
      args.runtime.createToolRunResult(
        "lizard",
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
      ...createLizardMetricsDiagnostics(cachedMetrics.metrics.files, args.mode, "lizard"),
    );
  }

  return resolvedProjects.unsupportedFiles.sort((left, right) => left.localeCompare(right));
}

function appendJavaScriptMetricsNotes(args: {
  mode: SharedMetricsMode;
  notes: string[];
  runtime: JavaScriptRunnerRuntime;
  stageId: StageResult["stageId"];
  toolRuns: readonly ReturnType<JavaScriptRunnerRuntime["createToolRunResult"]>[];
  totals: JavaScriptMetricsTotals;
  unsupportedFiles: readonly string[];
}): void {
  args.notes.push(
    args.runtime.readSharedMetricsNote(
      "JavaScript/TypeScript",
      args.mode,
      args.totals.scannedFileCount,
      args.totals.totalSloc,
      args.totals.totalBlocks,
      args.totals.maxComplexity,
      args.totals.maxRank,
      args.totals.minMaintainability,
      args.totals.minMaintainabilityRank,
      "functions",
    ),
  );

  if (args.toolRuns.some((toolRun) => toolRun.cacheHit)) {
    args.notes.push("Reused cached JavaScript/TypeScript metrics for this file batch.");
  }

  if (args.unsupportedFiles.length > 0) {
    args.notes.push(
      `Stage '${args.stageId}' is not implemented yet for non-JavaScript/TypeScript files in this selection: ${args.unsupportedFiles.join(", ")}.`,
    );
  }
}

async function getJavaScriptMetricsProjectMetrics(
  project: JavaScriptMetricsProject & { files: string[] },
  runtime: JavaScriptRunnerRuntime,
): Promise<{ cacheHit: boolean; metrics: JavaScriptMetricsProjectMetrics }> {
  const manifestKey = createJavaScriptMetricsManifestKey(project);
  const cacheKey = await createJavaScriptMetricsCacheKey(project, manifestKey);
  const cached = await runtime.getCachedValue("metrics:javascript", manifestKey, cacheKey, () =>
    runJavaScriptMetricsProjectTask(project, runtime),
  );

  return {
    cacheHit: cached.cacheHit,
    metrics: cached.value,
  };
}

function createJavaScriptMetricsManifestKey(project: {
  files: string[];
  packageJsonPath: string;
}): string {
  return `${project.packageJsonPath}:${[...project.files].sort().join("|")}`;
}

async function createJavaScriptMetricsCacheKey(
  project: { files: string[]; packageJsonPath: string },
  manifestKey = createJavaScriptMetricsManifestKey(project),
): Promise<string> {
  const [configFingerprint, fileEntries] = await Promise.all([
    readJavaScriptMetricsConfigFingerprint(project.files),
    Promise.all(
      [...project.files]
        .sort((left, right) => left.localeCompare(right))
        .map(async (file) => {
          const fileStats = await stat(file);
          return `${file}@${fileStats.size}:${fileStats.mtimeMs}`;
        }),
    ),
  ]);

  return `${manifestKey}:${configFingerprint}:${fileEntries.join("|")}`;
}

async function readJavaScriptMetricsConfigFingerprint(files: readonly string[]): Promise<string> {
  const fingerprints = await Promise.all(
    [...files]
      .sort((left, right) => left.localeCompare(right))
      .map(async (file) => {
        const configPath = await findNearestLizardConfig(file);
        return readConfigFingerprint(configPath);
      }),
  );

  return [...new Set(fingerprints)].join("|");
}

async function runJavaScriptMetricsProjectTask(
  project: JavaScriptMetricsProject & { files: string[] },
  runtime: JavaScriptRunnerRuntime,
): Promise<JavaScriptMetricsProjectMetrics> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "aiq-js-metrics-"));

  try {
    const inputFile = path.join(tempDir, "files.txt");
    await writeFile(inputFile, `${project.files.join("\n")}\n`, "utf8");
    const args = commands.createLizardArgs({
      inputFile,
      languages: ["javascript", "typescript", "tsx"],
    });
    const outcome = await runtime.runExecutable(
      runtime.resolveUvxCommand(),
      args,
      project.projectRoot,
      runtime.signal,
    );
    if (outcome.exitCode !== 0) {
      throw new Error(
        runtime.readProcessFailureMessage(
          "lizard",
          outcome.stderr,
          outcome.stdout,
          outcome.exitCode,
        ),
      );
    }

    return {
      args,
      durationMs: outcome.durationMs,
      exitCode: outcome.exitCode,
      files: await parsers.parseLizardMetrics(outcome.stdout, project.projectRoot, project.files),
      finishedAt: outcome.finishedAt,
      startedAt: outcome.startedAt,
    };
  } finally {
    await rm(tempDir, { force: true, recursive: true }).catch(() => undefined);
  }
}
