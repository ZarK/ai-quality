import type { RunResult, StageStatus } from "@tjalve/aiq/model";

import {
  type AiuQualityFinding,
  type AiuQualitySelectedTarget,
  type AiuQualityStage,
  type AiuQualityTrustedState,
  type AiuStateValueKind,
  type AiuTrustedStateCommandRef,
  staleAfterMs,
} from "./evidence-types.js";

export function createState(input: {
  affectedPaths: readonly string[];
  command: AiuTrustedStateCommandRef;
  failingChecks: string[];
  findings: AiuQualityFinding[];
  lastRunStatus: AiuStateValueKind;
  recordedAt: string;
  ready: boolean;
  selectedTarget?: AiuQualitySelectedTarget;
  stages: AiuQualityStage[];
  status: "fail" | "pass";
  summary: string;
}): AiuQualityTrustedState {
  return {
    sourceId: "aiq",
    observedAt: input.recordedAt,
    trustLevel: "trusted",
    capabilities: { quality: "supported" },
    freshness: {
      kind: "fresh",
      observedAt: input.recordedAt,
      ageMs: 0,
      staleAfterMs,
    },
    value: {
      kind: "quality",
      status: input.status,
      summary: input.summary,
      ready: input.ready,
      lastRunStatus: input.lastRunStatus,
      stages: input.stages,
      findings: input.findings,
      failingChecks: input.failingChecks,
      affectedPaths: [...input.affectedPaths],
      nextCommand: input.command,
      rerunCommand: input.command,
      ...(input.selectedTarget === undefined ? {} : { selectedTarget: input.selectedTarget }),
      humanApprovalRequired: false,
      supplyChainApprovalRequired: false,
    },
  };
}

export function stageFindings(
  stage: RunResult["stages"][number],
  report: RunResult,
  command: AiuTrustedStateCommandRef,
): AiuQualityFinding[] {
  if (stage.diagnostics.length === 0) {
    return [
      {
        id: `${stage.stageId}:stage`,
        title: `${stage.stageId} did not pass`,
        stageId: stage.stageId,
        status: "fail",
        severity: stage.status === "not_implemented" ? "medium" : "high",
        affectedPaths: stageAffectedPaths(stage, report),
        rerunCommand: command,
      },
    ];
  }

  return stage.diagnostics.map((diagnostic, index) => ({
    id: `${stage.stageId}:${String(index + 1)}`,
    title: diagnostic.message,
    stageId: stage.stageId,
    status: "fail",
    severity: diagnostic.severity === "warning" ? "medium" : "high",
    affectedPaths: [diagnostic.file],
    rerunCommand: command,
  }));
}

export function stageAffectedPaths(
  stage: RunResult["stages"][number],
  report: RunResult,
): string[] {
  const diagnosticPaths = stage.diagnostics.map((diagnostic) => diagnostic.file);
  return uniqueStrings(
    diagnosticPaths.length > 0 ? diagnosticPaths : report.request.manifest.files,
  );
}

export function createRunCommand(files: readonly string[]): AiuTrustedStateCommandRef {
  const argv = files.length === 0 ? ["aiq", "run", "."] : ["aiq", "run", ...files];
  return {
    id: "aiq-run",
    argv: argv as [string, ...string[]],
    timeoutMs: 600_000,
    maxOutputBytes: 1_048_576,
  };
}

export function mapStageStatus(status: StageStatus): AiuStateValueKind {
  if (status === "passed") {
    return "pass";
  }
  if (status === "not_implemented") {
    return "unsupported";
  }
  return "fail";
}

export function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}
