import type { PlannedTask, StageResult } from "./contracts.js";
import * as parsers from "./parsers/index.js";
import { AiqEngineCancelledError } from "./run.js";
import { biomeExtensions } from "./runners-file-types.js";
import {
  filterFiles,
  findSharedNativeConfig,
  isAbortError,
  readProcessFailureMessage,
  resolvePackageBinaryPath,
  runNodeTool,
} from "./runners-process.js";
import {
  createExecutionFailureStage,
  createNoopStageResult,
  createProcessFailureDiagnostic,
  createToolRunResult,
} from "./runners-results.js";
import * as commands from "./tools/command-builders.js";
import { findNearestBiomeConfig } from "./tools/native-config.js";

export async function runBiomeLintTask(
  task: PlannedTask,
  cwd: string,
  signal?: AbortSignal,
): Promise<StageResult> {
  const files = filterFiles(task.files, biomeExtensions);
  if (files.length === 0) {
    return createNoopStageResult(task.stageId, "No Biome-supported files were selected for lint.");
  }

  const configPath = await findSharedNativeConfig(files, findNearestBiomeConfig);
  const args = commands.createBiomeLintArgs({
    ...(configPath === undefined ? {} : { configPath }),
    files,
  });

  try {
    const outcome = await runNodeTool(
      resolvePackageBinaryPath("@biomejs/biome/package.json", "bin/biome"),
      args,
      cwd,
      signal,
    );
    const diagnostics = parsers.parseBiomeDiagnostics(outcome.stdout, cwd);
    const status = resolveBiomeStatus(outcome.exitCode, diagnostics.length);

    addBiomeProcessFailureDiagnostic(status, diagnostics, files, cwd, outcome, "Biome");

    return {
      diagnostics,
      durationMs: outcome.durationMs,
      notes: readBiomeLintNotes(status, diagnostics.length, configPath),
      stageId: task.stageId,
      status,
      toolRuns: [
        createToolRunResult(
          "biome",
          args,
          outcome.durationMs,
          outcome.exitCode,
          status,
          outcome.finishedAt,
          outcome.startedAt,
        ),
      ],
    };
  } catch (error) {
    if (isAbortError(error)) {
      throw new AiqEngineCancelledError();
    }

    return createExecutionFailureStage(task.stageId, "biome", files[0] ?? cwd, error);
  }
}

export async function runBiomeFormatTask(
  task: PlannedTask,
  cwd: string,
  signal?: AbortSignal,
): Promise<StageResult> {
  const files = filterFiles(task.files, biomeExtensions);
  if (files.length === 0) {
    return createNoopStageResult(
      task.stageId,
      "No Biome-supported files were selected for format.",
    );
  }

  const configPath = await findSharedNativeConfig(files, findNearestBiomeConfig);
  const args = commands.createBiomeFormatArgs({
    ...(configPath === undefined ? {} : { configPath }),
    files,
  });

  try {
    const outcome = await runNodeTool(
      resolvePackageBinaryPath("@biomejs/biome/package.json", "bin/biome"),
      args,
      cwd,
      signal,
    );
    const diagnostics = parsers.parseBiomeDiagnostics(outcome.stdout, cwd);
    const status = resolveBiomeStatus(outcome.exitCode, diagnostics.length);

    addBiomeProcessFailureDiagnostic(status, diagnostics, files, cwd, outcome, "Biome format");

    return {
      diagnostics,
      durationMs: outcome.durationMs,
      notes: readBiomeFormatNotes(status, diagnostics.length, configPath),
      stageId: task.stageId,
      status,
      toolRuns: [
        createToolRunResult(
          "biome",
          args,
          outcome.durationMs,
          outcome.exitCode,
          status,
          outcome.finishedAt,
          outcome.startedAt,
        ),
      ],
    };
  } catch (error) {
    if (isAbortError(error)) {
      throw new AiqEngineCancelledError();
    }

    return createExecutionFailureStage(task.stageId, "biome", files[0] ?? cwd, error);
  }
}

function resolveBiomeStatus(
  exitCode: number | undefined,
  diagnosticCount: number,
): "failed" | "passed" {
  return exitCode === 0 && diagnosticCount === 0 ? "passed" : "failed";
}

function addBiomeProcessFailureDiagnostic(
  status: "failed" | "passed",
  diagnostics: ReturnType<typeof parsers.parseBiomeDiagnostics>,
  files: string[],
  cwd: string,
  outcome: Awaited<ReturnType<typeof runNodeTool>>,
  label: string,
): void {
  if (status !== "failed" || diagnostics.length > 0) {
    return;
  }

  diagnostics.push(
    createProcessFailureDiagnostic(
      files[0] ?? cwd,
      "biome",
      readProcessFailureMessage(label, outcome.stderr, outcome.stdout, outcome.exitCode),
    ),
  );
}

function readBiomeLintNotes(
  status: "failed" | "passed",
  diagnosticCount: number,
  configPath: string | undefined,
): string[] {
  if (status === "passed") {
    return [
      configPath === undefined ? "Biome lint passed." : `Biome lint passed using ${configPath}.`,
    ];
  }

  return [`Biome reported ${diagnosticCount} diagnostic${diagnosticCount === 1 ? "" : "s"}.`];
}

function readBiomeFormatNotes(
  status: "failed" | "passed",
  diagnosticCount: number,
  configPath: string | undefined,
): string[] {
  if (status === "passed") {
    return [
      configPath === undefined
        ? "Biome format passed."
        : `Biome format passed using ${configPath}.`,
    ];
  }

  return [
    `Biome reported ${diagnosticCount} formatting diagnostic${diagnosticCount === 1 ? "" : "s"}.`,
  ];
}
