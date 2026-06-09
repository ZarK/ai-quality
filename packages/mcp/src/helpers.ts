import path from "node:path";

import { aiqProfileNames, loadAiqProgress, stageIds } from "@tjalve/aiq/api";
import type {
  AiqProfileName,
  ResolvedAiqConfig,
  RunPlan,
  RunResult,
  StageId,
} from "@tjalve/aiq/api";
import type { AiqMcpExplainOptions, ResolvedMcpSelection } from "./types.js";

export function formatDiagnosticExplanation(report: RunResult): string {
  if (report.summary.diagnosticCount === 0) {
    return "AIQ found no diagnostics.";
  }

  const lines = [
    `AIQ diagnostics: ${report.summary.diagnosticCount}`,
    `Status: ${report.summary.status}`,
  ];

  for (const stage of report.stages) {
    if (stage.diagnostics.length === 0) {
      continue;
    }

    lines.push(`${stage.stageId}:`);
    for (const diagnostic of stage.diagnostics) {
      const location =
        diagnostic.range === undefined
          ? diagnostic.file
          : `${diagnostic.file}:${diagnostic.range.startLine}:${diagnostic.range.startColumn}`;
      lines.push(`- [${diagnostic.severity}] ${location} ${diagnostic.message}`);
    }
  }

  return lines.join("\n");
}

export function assertExplainOptions(options: AiqMcpExplainOptions): void {
  if (normalizeOptionalString(options.reportPath) !== undefined) {
    return;
  }

  if (
    options.files !== undefined &&
    normalizeExplicitFiles(options.cwd ?? process.cwd(), options.files).length > 0
  ) {
    return;
  }

  throw new Error("Provide files or reportPath.");
}

export function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized === undefined || normalized.length === 0 ? undefined : normalized;
}

export function mapResolvedSelection(resolved: ResolvedAiqConfig): ResolvedMcpSelection {
  return {
    cwd: resolved.cwd,
    stages: [...resolved.stages] as StageId[],
    ...(resolved.stageConfigurations === undefined
      ? {}
      : { stageConfigurations: resolved.stageConfigurations }),
    profile: resolved.profile,
  };
}

export function formatMcpPlanText(plan: RunPlan): string {
  return [
    "AIQ plan",
    `Profile: ${plan.profile}`,
    `Stages: ${plan.stages.length === 0 ? "none configured yet" : plan.stages.join(", ")}`,
    `Files: ${plan.summary.fileCount}`,
    `Tasks: ${plan.summary.taskCount}`,
  ].join("\n");
}

export function formatMcpStatusText(selection: ResolvedMcpSelection): string {
  return [
    "AIQ status",
    `Profile: ${selection.profile}`,
    `Stages: ${selection.stages.length === 0 ? "none configured yet" : selection.stages.join(", ")}`,
    selection.workflow === undefined
      ? undefined
      : `Current stage: ${selection.workflow.currentStage.index} ${selection.workflow.currentStage.id}`,
  ]
    .filter((line): line is string => line !== undefined)
    .join("\n");
}

export async function loadFileBackedProgress(cwd: string) {
  const progress = await loadAiqProgress(cwd);
  return progress.source === "file" ? progress : undefined;
}

export function normalizeExplicitFiles(cwd: string, files: readonly string[]): string[] {
  const normalized = new Set<string>();

  for (const file of files.map((entry) => entry.trim()).filter((entry) => entry.length > 0)) {
    normalized.add(path.resolve(cwd, file));
  }

  return [...normalized].sort();
}

export function parseStageList(values: readonly string[], label: string): StageId[] {
  const unique = new Set<StageId>();
  const stages: StageId[] = [];

  for (const value of values.map((entry) => entry.trim()).filter((entry) => entry.length > 0)) {
    if (!stageIds.includes(value as StageId)) {
      throw new Error(`${label} contains unsupported stage '${value}'.`);
    }

    const stage = value as StageId;
    if (!unique.has(stage)) {
      unique.add(stage);
      stages.push(stage);
    }
  }

  return stages;
}

export function normalizeStageOverride(values: readonly string[] | undefined, label: string) {
  if (values === undefined) {
    return undefined;
  }

  const stages = parseStageList(values, label);
  return stages.length === 0 ? undefined : stages;
}

export function normalizeProfileOverride(value: string | undefined, label: string) {
  const normalized = value?.trim();
  return normalized === undefined || normalized.length === 0
    ? undefined
    : parseProfile(normalized, label);
}

export function parseProfile(value: string, label: string): AiqProfileName {
  const normalized = value.trim();
  if (!aiqProfileNames.includes(normalized as AiqProfileName)) {
    throw new Error(`${label} must be one of ${aiqProfileNames.join(", ")}.`);
  }

  return normalized as AiqProfileName;
}
