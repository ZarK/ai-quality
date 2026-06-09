import type { RunResult } from "@tjalve/aiq/model";

import {
  createRunCommand,
  createState,
  mapStageStatus,
  stageAffectedPaths,
  stageFindings,
  uniqueStrings,
} from "./evidence-state.js";
import {
  type AieGateResult,
  type AiqQualityEvidence,
  type AiuStateValueKind,
  type MalformedReport,
  type MissingReport,
  aiqEvidenceSchemaVersion,
  staleAfterMs,
} from "./evidence-types.js";

export function createReportEvidence(
  report: RunResult,
  reportPath: string,
  recordedAt: string,
): AiqQualityEvidence {
  const finishedAtMs = Date.parse(report.finishedAt);
  const recordedAtMs = Date.parse(recordedAt);
  const ageMs =
    Number.isFinite(finishedAtMs) && Number.isFinite(recordedAtMs)
      ? Math.max(0, recordedAtMs - finishedAtMs)
      : undefined;
  const stale = ageMs === undefined || ageMs > staleAfterMs;
  if (stale) {
    return buildEvidence({
      affectedPaths: report.request.manifest.files,
      lastRunStatus: "stale",
      recordedAt,
      reportPath,
      result: "stale",
      runId: report.runId,
      finishedAt: report.finishedAt,
      ...(ageMs === undefined ? {} : { ageMs }),
      summary: "AIQ report is stale; rerun AIQ before using quality evidence.",
      targetId: "stale-report",
      targetTitle: "Refresh stale AIQ report",
    });
  }

  if (report.summary.status === "passed") {
    return createPassedEvidence(report, reportPath, recordedAt, ageMs);
  }

  return createFailedEvidence(report, reportPath, recordedAt, ageMs);
}

function createPassedEvidence(
  report: RunResult,
  reportPath: string,
  recordedAt: string,
  ageMs: number | undefined,
): AiqQualityEvidence {
  const command = createRunCommand(report.request.manifest.files);
  return {
    schemaVersion: aiqEvidenceSchemaVersion,
    result: "passed",
    trust: "local-evidence",
    summary: `AIQ quality passed with ${String(report.summary.stageCount)} stage(s) and ${String(report.summary.fileCount)} file(s).`,
    recordedAt,
    reasonCode: "local-evidence-found",
    stale: false,
    metadata: {
      aiq: {
        reportPath,
        reportStatus: "pass",
        runId: report.runId,
        finishedAt: report.finishedAt,
        ...(ageMs === undefined ? {} : { ageMs }),
        staleAfterMs,
      },
    },
    states: [
      createState({
        affectedPaths: report.request.manifest.files,
        failingChecks: [],
        findings: [],
        lastRunStatus: "pass",
        recordedAt,
        ready: false,
        stages: report.stages.map((stage) => ({
          affectedPaths: stageAffectedPaths(stage, report),
          id: stage.stageId,
          rerunCommand: command,
          status: mapStageStatus(stage.status),
          title: stage.stageId,
        })),
        status: "pass",
        summary: `AIQ quality passed with ${String(report.summary.stageCount)} stage(s).`,
        command,
      }),
    ],
  };
}

function createFailedEvidence(
  report: RunResult,
  reportPath: string,
  recordedAt: string,
  ageMs: number | undefined,
): AiqQualityEvidence {
  const failingStages = report.stages.filter((stage) => stage.status !== "passed");
  const firstStage = failingStages[0];
  const selectedPaths =
    firstStage === undefined
      ? report.request.manifest.files
      : stageAffectedPaths(firstStage, report);
  const command = createRunCommand(report.request.manifest.files);
  const findings = failingStages.flatMap((stage) => stageFindings(stage, report, command));
  const stages = report.stages.map((stage) => ({
    affectedPaths: stageAffectedPaths(stage, report),
    id: stage.stageId,
    rerunCommand: command,
    status: mapStageStatus(stage.status),
    title: stage.stageId,
  }));

  return {
    schemaVersion: aiqEvidenceSchemaVersion,
    result: "failed",
    trust: "local-evidence",
    summary: `AIQ quality ${report.summary.status}; ${String(failingStages.length)} stage(s) need attention.`,
    recordedAt,
    reasonCode: "local-evidence-found",
    stale: false,
    metadata: {
      aiq: {
        reportPath,
        reportStatus: "fail",
        runId: report.runId,
        finishedAt: report.finishedAt,
        ...(ageMs === undefined ? {} : { ageMs }),
        staleAfterMs,
      },
    },
    states: [
      createState({
        affectedPaths: uniqueStrings(
          failingStages.flatMap((stage) => stageAffectedPaths(stage, report)),
        ),
        failingChecks: failingStages.map((stage) => stage.stageId),
        findings,
        lastRunStatus: "fail",
        recordedAt,
        ready: true,
        ...(firstStage === undefined
          ? {}
          : {
              selectedTarget: {
                kind: "stage",
                id: firstStage.stageId,
                title: `Fix AIQ ${firstStage.stageId}`,
                stageId: firstStage.stageId,
                status: "fail",
                affectedPaths: selectedPaths,
                rerunCommand: command,
                expectedEvidence: "Rerun AIQ and refresh aiq evidence after the stage passes.",
              },
            }),
        stages,
        status: "fail",
        summary: `AIQ quality ${report.summary.status}; rerun after fixing failing stages.`,
        command,
      }),
    ],
  };
}

export function createUnavailableEvidence(
  report: MissingReport | MalformedReport,
  recordedAt: string,
): AiqQualityEvidence {
  if (report.kind === "missing") {
    return buildEvidence({
      affectedPaths: [],
      lastRunStatus: "missing",
      recordedAt,
      reportPath: report.reportPath,
      result: "missing",
      summary: "AIQ report is missing; run AIQ before using quality evidence.",
      targetId: "missing-report",
      targetTitle: "Create AIQ report",
    });
  }

  return buildEvidence({
    affectedPaths: [],
    lastRunStatus: "malformed",
    recordedAt,
    reportPath: report.reportPath,
    result: "failed",
    summary: "AIQ report is malformed or unreadable; rerun AIQ to refresh quality evidence.",
    targetId: "malformed-report",
    targetTitle: "Replace malformed AIQ report",
  });
}

function buildEvidence(input: {
  affectedPaths: readonly string[];
  ageMs?: number;
  finishedAt?: string;
  lastRunStatus: AiuStateValueKind;
  recordedAt: string;
  reportPath: string;
  result: AieGateResult;
  runId?: string;
  summary: string;
  targetId: string;
  targetTitle: string;
}): AiqQualityEvidence {
  const command = createRunCommand(input.affectedPaths);
  return {
    schemaVersion: aiqEvidenceSchemaVersion,
    result: input.result,
    trust: "local-evidence",
    summary: input.summary,
    recordedAt: input.recordedAt,
    reasonCode:
      input.result === "missing"
        ? "missing-evidence"
        : input.result === "stale"
          ? "stale-evidence"
          : input.lastRunStatus === "malformed"
            ? "malformed-evidence"
            : "local-evidence-found",
    stale: input.result === "stale",
    metadata: {
      aiq: {
        reportPath: input.reportPath,
        reportStatus: input.lastRunStatus,
        ...(input.runId === undefined ? {} : { runId: input.runId }),
        ...(input.finishedAt === undefined ? {} : { finishedAt: input.finishedAt }),
        ...(input.ageMs === undefined ? {} : { ageMs: input.ageMs }),
        staleAfterMs,
      },
    },
    states: [
      createState({
        affectedPaths: [...input.affectedPaths],
        failingChecks: [input.targetId],
        findings: [
          {
            id: input.targetId,
            title: input.targetTitle,
            stageId: "aiq-evidence",
            status: "fail",
            severity: "high",
            affectedPaths: [...input.affectedPaths],
            rerunCommand: command,
          },
        ],
        lastRunStatus: input.lastRunStatus,
        recordedAt: input.recordedAt,
        ready: true,
        selectedTarget: {
          kind: "finding",
          id: input.targetId,
          title: input.targetTitle,
          stageId: "aiq-evidence",
          status: "fail",
          affectedPaths: [...input.affectedPaths],
          rerunCommand: command,
          expectedEvidence:
            "Run AIQ and refresh aiq evidence before claiming quality is satisfied.",
        },
        stages: [
          {
            id: "aiq-evidence",
            title: "AIQ evidence",
            status: "fail",
            affectedPaths: [...input.affectedPaths],
            rerunCommand: command,
          },
        ],
        status: "fail",
        summary: input.summary,
        command,
      }),
    ],
  };
}
