import { readFile } from "node:fs/promises";

import { loadAiqProgress } from "@tjalve/aiq/config";
import { resolvePlanArtifactPath, resolveReportArtifactPath } from "@tjalve/aiq/engine";
import type { StageId } from "@tjalve/aiq/model";

import { formatStatusOutput, toWorkflowStageOutput } from "./output.js";
import { resolveCliConfig } from "./requests.js";
import { formatError, isErrorCode } from "./shared.js";
import { type CliIo, type ParsedArgs, cliStageShortcutIds } from "./types.js";
import { createDefaultRunOutput, resolveNextCommand } from "./workflow.js";

export async function runStatusCommand(parsed: ParsedArgs, io: CliIo): Promise<number> {
  try {
    const [resolvedConfig, loadedProgress] = await Promise.all([
      resolveCliConfig(parsed, io, {
        includeProgressStage: true,
        surface: "cli",
      }),
      loadAiqProgress(io.cwd),
    ]);
    const reportPath = resolveReportArtifactPath(resolvedConfig.cwd);
    const planPath = resolvePlanArtifactPath(resolvedConfig.cwd);
    const report = await readStatusReport(reportPath);
    const artifactPaths = {
      plan: report.artifactPaths?.plan ?? planPath,
      report: report.artifactPaths?.report ?? reportPath,
    };
    const currentStage = toWorkflowStageOutput(loadedProgress.progress.current_stage);
    const lastRun = report.lastRun;
    const currentStageSatisfied = resolveLastRunCurrentStageSatisfied(lastRun, currentStage);
    io.stdout.write(
      formatStatusOutput(parsed.format, {
        artifactPaths,
        currentStage,
        ...(currentStageSatisfied === undefined ? {} : { currentStageSatisfied }),
        defaultRun: createDefaultRunOutput(loadedProgress.progress.current_stage),
        lastRun,
        nextCommand: resolveNextCommand(
          currentStage,
          lastRun.failedStages,
          lastRun.status,
          currentStageSatisfied,
        ),
        progressLastRun: loadedProgress.progress.last_run,
        progressPath: loadedProgress.path,
        progressSource: loadedProgress.source,
        selectedStages: resolvedConfig.stages,
      }),
    );
    return 0;
  } catch (error) {
    io.stderr.write(`${formatError(error)}\n`);
    return 2;
  }
}

type StatusLastRun = Parameters<typeof formatStatusOutput>[1]["lastRun"];

async function readStatusReport(reportPath: string): Promise<{
  artifactPaths?: {
    plan?: string;
    report?: string;
  };
  lastRun: StatusLastRun;
}> {
  let rawReport: string;
  try {
    rawReport = await readFile(reportPath, "utf8");
  } catch (error) {
    if (isErrorCode(error, "ENOENT")) {
      return { lastRun: createEmptyLastRun("none") };
    }

    return { lastRun: createEmptyLastRun("unreadable") };
  }

  const value = readReportObject(rawReport);
  if (value === undefined) {
    return { lastRun: createEmptyLastRun("unreadable") };
  }

  const status = readRunStatus(value);
  if (status === undefined) {
    return { lastRun: createEmptyLastRun("unreadable") };
  }

  const runId = typeof value.runId === "string" ? value.runId : undefined;
  const finishedAt = typeof value.finishedAt === "string" ? value.finishedAt : undefined;
  const artifactPaths = readArtifactPaths(value);

  return {
    ...(artifactPaths === undefined ? {} : { artifactPaths }),
    lastRun: {
      failedStages: readFailedStages(value),
      ...(finishedAt === undefined ? {} : { finishedAt }),
      ...(runId === undefined ? {} : { runId }),
      stages: readStageStatuses(value),
      status,
    },
  };
}

function createEmptyLastRun(status: "none" | "unreadable"): StatusLastRun {
  return {
    failedStages: [],
    stages: [],
    status,
  };
}

function readReportObject(rawReport: string): Record<string, unknown> | undefined {
  try {
    const value = JSON.parse(rawReport) as unknown;
    return isRecord(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function readArtifactPaths(value: Record<string, unknown>):
  | {
      plan?: string;
      report?: string;
    }
  | undefined {
  const artifacts = isRecord(value.artifacts) ? value.artifacts : {};
  const planPath = typeof artifacts.planPath === "string" ? artifacts.planPath : undefined;
  const reportPath = typeof artifacts.reportPath === "string" ? artifacts.reportPath : undefined;
  return createArtifactPaths(planPath, reportPath);
}

function createArtifactPaths(planPath: string | undefined, reportPath: string | undefined) {
  if (planPath === undefined && reportPath === undefined) {
    return undefined;
  }

  return {
    ...(planPath === undefined ? {} : { plan: planPath }),
    ...(reportPath === undefined ? {} : { report: reportPath }),
  };
}

function readRunStatus(value: Record<string, unknown>): StatusLastRun["status"] | undefined {
  const summary = value.summary;
  if (!isRecord(summary)) {
    return undefined;
  }

  switch (summary.status) {
    case "failed":
    case "not_implemented":
    case "passed":
      return summary.status;
    default:
      return undefined;
  }
}

function readFailedStages(value: Record<string, unknown>) {
  return readStageStatuses(value)
    .filter((stage) => stage.status !== "passed")
    .map((stage) => stage.stage);
}

function readStageStatuses(value: Record<string, unknown>) {
  if (!Array.isArray(value.stages)) {
    return [];
  }

  return value.stages
    .filter((stage): stage is Record<string, unknown> => isRecord(stage))
    .map((stage) => {
      const stageId = typeof stage.stageId === "string" ? stage.stageId : undefined;
      const status = readStageStatus(stage.status);
      return stageId === undefined || !isStageId(stageId) || status === undefined
        ? undefined
        : {
            stage: toWorkflowStageOutput(resolveStageIndex(stageId)),
            status,
          };
    })
    .filter((stage): stage is NonNullable<typeof stage> => stage !== undefined);
}

function resolveLastRunCurrentStageSatisfied(
  lastRun: StatusLastRun,
  currentStage: ReturnType<typeof toWorkflowStageOutput>,
): boolean | undefined {
  const stage = lastRun.stages.find((candidate) => candidate.stage.id === currentStage.id);
  return stage === undefined ? undefined : stage.status === "passed";
}

function readStageStatus(value: unknown): "failed" | "not_implemented" | "passed" | undefined {
  switch (value) {
    case "failed":
    case "not_implemented":
    case "passed":
      return value;
    default:
      return undefined;
  }
}

function resolveStageIndex(stageId: StageId): number {
  return cliStageShortcutIds.indexOf(stageId);
}

function isStageId(value: string | undefined): value is StageId {
  return value !== undefined && cliStageShortcutIds.includes(value as StageId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
