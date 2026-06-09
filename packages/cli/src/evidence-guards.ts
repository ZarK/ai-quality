import type { RunResult, StageStatus } from "@tjalve/aiq/model";

const runSummaryNumberFields = [
  "cacheHitCount",
  "cacheHitRate",
  "cacheMissCount",
  "diagnosticCount",
  "durationMs",
  "fileCount",
  "notImplementedStageCount",
  "stageCount",
  "taskCount",
  "toolDurationMs",
  "toolRunCount",
] as const;

export function isRunResult(value: unknown): value is RunResult {
  if (!isRecord(value)) {
    return false;
  }
  return (
    value.artifactType === "report" &&
    typeof value.finishedAt === "string" &&
    typeof value.runId === "string" &&
    isRunSummary(value.summary) &&
    Array.isArray(value.stages) &&
    value.stages.every(isRunStage) &&
    isRunRequest(value.request)
  );
}

function isRunSummary(value: unknown): value is RunResult["summary"] {
  return (
    isRecord(value) &&
    isRunStatus(value.status) &&
    runSummaryNumberFields.every((field) => typeof value[field] === "number")
  );
}

function isRunRequest(value: unknown): value is RunResult["request"] {
  return isRecord(value) && isRunManifest(value.manifest);
}

function isRunManifest(value: unknown): value is RunResult["request"]["manifest"] {
  return (
    isRecord(value) &&
    Array.isArray(value.files) &&
    value.files.every((file) => typeof file === "string")
  );
}

function isRunStatus(value: unknown): value is RunResult["summary"]["status"] {
  return value === "failed" || value === "not_implemented" || value === "passed";
}

function isRunStage(value: unknown): value is RunResult["stages"][number] {
  return (
    isRecord(value) &&
    typeof value.stageId === "string" &&
    isStageStatus(value.status) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isDiagnostic)
  );
}

function isStageStatus(value: unknown): value is StageStatus {
  return value === "failed" || value === "not_implemented" || value === "passed";
}

function isDiagnostic(value: unknown): value is RunResult["stages"][number]["diagnostics"][number] {
  return (
    isRecord(value) &&
    typeof value.file === "string" &&
    typeof value.message === "string" &&
    isDiagnosticSeverity(value.severity) &&
    typeof value.source === "string"
  );
}

function isDiagnosticSeverity(
  value: unknown,
): value is RunResult["stages"][number]["diagnostics"][number]["severity"] {
  return value === "error" || value === "warning" || value === "info";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
