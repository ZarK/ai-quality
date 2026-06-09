import { formatBenchmarkReportAsJson, formatBenchmarkReportAsText } from "@tjalve/aiq/benchmark";
import type { RunPlan, RunResult } from "@tjalve/aiq/model";
import {
  formatPlanAsJson,
  formatPlanAsText,
  formatRunResultAsJson,
  formatRunResultAsText,
} from "@tjalve/aiq/reporters";

import type { BenchmarkReport, RunWorkflowOutput } from "./output-types.js";
import {
  collectVerboseToolRuns,
  escapeRegExp,
  formatRunWorkflowNextSteps,
  formatRunWorkflowPrelude,
  formatVerboseToolRunDetails,
} from "./output-workflow.js";
import type { OutputFormat } from "./types.js";

export function formatBenchmarkOutput(format: OutputFormat, report: BenchmarkReport): string {
  return format === "json"
    ? formatBenchmarkReportAsJson(report)
    : formatBenchmarkReportAsText(report);
}

export function formatPlanOutput(format: OutputFormat, plan: RunPlan): string {
  return format === "json" ? formatPlanAsJson(plan) : formatPlanAsText(plan);
}

export function formatRunResultOutput(
  format: OutputFormat,
  result: RunResult,
  displayMode?: RunResult["mode"] | "run",
  options: { verbose?: boolean; workflow?: RunWorkflowOutput } = {},
): string {
  if (format === "json") {
    return options.workflow === undefined
      ? formatRunResultAsJson(result)
      : `${JSON.stringify({ ...result, workflow: options.workflow }, null, 2)}\n`;
  }

  const detail = options.verbose === true;
  const baseOutput =
    displayMode === undefined || displayMode === result.mode
      ? formatRunResultAsText(result, { detail })
      : formatRunResultAsText(result, { detail }).replace(
          new RegExp(`^AIQ ${escapeRegExp(result.mode)}(?=\\n)`, "u"),
          `AIQ ${displayMode}`,
        );

  const parts = [
    options.workflow === undefined ? undefined : formatRunWorkflowPrelude(options.workflow),
    baseOutput.trimEnd(),
    options.verbose
      ? formatVerboseToolRunDetails(collectVerboseToolRuns(result)).trimEnd()
      : undefined,
    options.workflow === undefined ? undefined : formatRunWorkflowNextSteps(options.workflow),
  ].filter((part): part is string => part !== undefined && part.length > 0);

  return `${parts.join("\n")}\n`;
}

export function formatFirstRunResultDetails(result: RunResult): string {
  const diagnostics = result.stages.flatMap((stage) =>
    stage.diagnostics.map((diagnostic) => ({ diagnostic, stageId: stage.stageId })),
  );
  if (diagnostics.length === 0) {
    return "";
  }

  return [
    "First-run diagnostics:",
    ...diagnostics.slice(0, 5).map(({ diagnostic, stageId }) => {
      const file = diagnostic.file.length === 0 ? "workspace" : diagnostic.file;
      return `  - ${stageId}/${diagnostic.source}: ${file} - ${diagnostic.message}`;
    }),
    diagnostics.length > 5 ? `  ... ${diagnostics.length - 5} more diagnostic(s)` : undefined,
    "Remediation: fix the listed diagnostics, or run aiq setup if a tool prerequisite appears to be missing.",
    "",
  ]
    .filter((line): line is string => line !== undefined)
    .join("\n");
}

export function formatDryRunOutput(format: OutputFormat, plan: RunPlan): string {
  if (format === "json") {
    return `${JSON.stringify({ dryRun: true, plan }, null, 2)}\n`;
  }

  return [
    "AIQ dry run",
    `Run: ${plan.runId}`,
    `Context: ${plan.context}`,
    `Profile: ${plan.profile}`,
    `Files: ${plan.input.summary.fileCount}`,
    `Stages: ${plan.stages.length === 0 ? "none configured yet" : plan.stages.join(", ")}`,
    `Tasks: ${plan.summary.taskCount}`,
    "No tools executed and no artifacts written.",
    "",
  ].join("\n");
}
