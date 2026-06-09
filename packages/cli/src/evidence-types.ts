import type { RunResult } from "@tjalve/aiq/model";

export const aiqEvidenceSchemaVersion = 1 as const;
export const staleAfterMs = 24 * 60 * 60 * 1_000;

export type AieGateResult = "failed" | "missing" | "passed" | "stale";
export type AiuStateValueKind = "fail" | "malformed" | "missing" | "pass" | "stale" | "unsupported";

export interface AiuTrustedStateCommandRef {
  id: string;
  argv: [string, ...string[]];
  maxOutputBytes?: number;
  timeoutMs?: number;
}

export interface AiqQualityEvidence {
  schemaVersion: typeof aiqEvidenceSchemaVersion;
  result: AieGateResult;
  trust: "local-evidence";
  summary: string;
  recordedAt: string;
  reasonCode: "local-evidence-found" | "malformed-evidence" | "missing-evidence" | "stale-evidence";
  stale: boolean;
  metadata: {
    aiq: {
      reportPath: string;
      reportStatus: AiuStateValueKind;
      runId?: string;
      finishedAt?: string;
      ageMs?: number;
      staleAfterMs: number;
    };
  };
  states: [AiuQualityTrustedState];
}

export interface AiuQualityTrustedState {
  sourceId: "aiq";
  observedAt: string;
  trustLevel: "trusted";
  capabilities: {
    quality: "supported";
  };
  freshness: {
    kind: "fresh";
    observedAt: string;
    ageMs: 0;
    staleAfterMs: typeof staleAfterMs;
  };
  value: AiuQualityState;
}

export interface AiuQualityState {
  kind: "quality";
  status: "fail" | "pass";
  summary: string;
  ready: boolean;
  lastRunStatus: AiuStateValueKind;
  stages: AiuQualityStage[];
  findings: AiuQualityFinding[];
  failingChecks: string[];
  affectedPaths: string[];
  nextCommand: AiuTrustedStateCommandRef;
  rerunCommand: AiuTrustedStateCommandRef;
  selectedTarget?: AiuQualitySelectedTarget;
  humanApprovalRequired: false;
  supplyChainApprovalRequired: false;
}

export interface AiuQualityStage {
  id: string;
  title: string;
  status: AiuStateValueKind;
  affectedPaths: string[];
  rerunCommand: AiuTrustedStateCommandRef;
}

export interface AiuQualityFinding {
  id: string;
  title: string;
  stageId: string;
  status: "fail";
  severity: "high" | "medium";
  affectedPaths: string[];
  rerunCommand: AiuTrustedStateCommandRef;
}

export interface AiuQualitySelectedTarget {
  kind: "finding" | "stage";
  id: string;
  title: string;
  stageId?: string;
  status: "fail";
  affectedPaths: string[];
  rerunCommand: AiuTrustedStateCommandRef;
  expectedEvidence: string;
}

export interface LoadedReport {
  kind: "loaded";
  report: RunResult;
  reportPath: string;
}

export interface MissingReport {
  kind: "missing";
  reportPath: string;
}

export interface MalformedReport {
  kind: "malformed";
  reportPath: string;
}

export type ReportLoadResult = LoadedReport | MalformedReport | MissingReport;
