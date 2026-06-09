import type { RunResult, StageId, ToolRunResult } from "@tjalve/aiq/model";

import type {
  RunWorkflowOutput,
  StatusCommandOutput,
  WorkflowStageOutput,
} from "./output-types.js";
import { type OutputFormat, cliStageShortcutIds } from "./types.js";
import type { VerboseToolRunDetail } from "./types.js";

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function collectVerboseToolRuns(result: RunResult): VerboseToolRunDetail[] {
  return result.stages.flatMap((stage) =>
    stage.toolRuns.map((toolRun) => toVerboseToolRunDetail(stage.stageId, toolRun)),
  );
}

function toVerboseToolRunDetail(stageId: StageId, toolRun: ToolRunResult): VerboseToolRunDetail {
  return {
    args: toolRun.args,
    ...(toolRun.exitCode === undefined ? {} : { exitCode: toolRun.exitCode }),
    stageId,
    status: toolRun.status,
    tool: toolRun.tool,
  };
}

export function formatVerboseToolRunDetails(details: VerboseToolRunDetail[]): string {
  if (details.length === 0) {
    return "Verbose tool details:\n  No tool commands were executed.\n";
  }

  return [
    "Verbose tool details:",
    ...details.map((detail) => {
      const command = [detail.tool, ...detail.args].join(" ");
      const exitCode = detail.exitCode === undefined ? "n/a" : String(detail.exitCode);
      return `  - ${detail.stageId}: ${command} [status=${detail.status}, exit=${exitCode}]`;
    }),
    "",
  ].join("\n");
}

export function formatRunWorkflowPrelude(workflow: RunWorkflowOutput): string {
  return [
    "AIQ workflow",
    `Current stage: ${formatWorkflowStage(workflow.currentStage)} (${workflow.progressPath}, ${workflow.progressSource})`,
    `Default run: stages ${workflow.defaultRun.range} (${workflow.defaultRun.stages.map((stage) => stage.id).join(", ")})`,
    `Selected stages: ${workflow.selectedStages.length === 0 ? "none configured yet" : workflow.selectedStages.join(", ")}`,
    "",
  ].join("\n");
}

export function formatRunWorkflowNextSteps(workflow: RunWorkflowOutput): string {
  if (workflow.failedStages.length > 0) {
    return [
      "Workflow next:",
      ...workflow.debugCommands.map((command, index) => {
        const stage = workflow.failedStages[index];
        const label = stage === undefined ? "failed stage" : formatWorkflowStage(stage);
        return `  - Debug ${label}: ${command}`;
      }),
      `  - Then rerun: ${workflow.nextCommand}`,
      "",
    ].join("\n");
  }

  if (workflow.currentStageSatisfied !== undefined) {
    return [
      "Workflow next:",
      `  - Current stage satisfied: ${workflow.currentStageSatisfied ? "yes" : "no"} (${formatWorkflowStage(workflow.currentStage)})`,
      `  - ${workflow.currentStageSatisfied ? "Advance" : "Continue"}: ${workflow.nextCommand}`,
      "",
    ].join("\n");
  }

  return ["Workflow next:", `  - ${workflow.nextCommand}`, ""].join("\n");
}

export function formatStatusLastRun(lastRun: StatusCommandOutput["lastRun"]): string {
  if (lastRun.status === "none") {
    return "Last run: none";
  }

  const metadata = [lastRun.runId, lastRun.finishedAt].filter(
    (value): value is string => value !== undefined && value.length > 0,
  );
  return `Last run: ${lastRun.status}${metadata.length === 0 ? "" : ` (${metadata.join(", ")})`}`;
}

export function formatWorkflowStage(stage: WorkflowStageOutput): string {
  return `${stage.index} ${stage.name}`;
}

export function toWorkflowStageOutput(index: number): WorkflowStageOutput {
  const id = cliStageShortcutIds[index];
  if (id === undefined) {
    throw new Error(`Unknown AIQ stage index: ${index}`);
  }

  return {
    id,
    index,
    name: id,
  };
}

export function formatProgressStage(progress: unknown): string {
  if (
    typeof progress === "object" &&
    progress !== null &&
    "current_stage" in progress &&
    typeof progress.current_stage === "number"
  ) {
    return String(progress.current_stage);
  }

  return "unknown";
}

export function isJsonOutput(format: OutputFormat): boolean {
  return format === "json";
}
