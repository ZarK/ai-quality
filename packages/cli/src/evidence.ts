import { readFile } from "node:fs/promises";

import { resolveReportArtifactPath } from "@tjalve/aiq/engine";

import { createReportEvidence, createUnavailableEvidence } from "./evidence-builders.js";
import { isRunResult } from "./evidence-guards.js";
import type { AiqQualityEvidence, ReportLoadResult } from "./evidence-types.js";
import { isErrorCode } from "./shared.js";

export async function createAiqQualityEvidence(cwd: string): Promise<AiqQualityEvidence> {
  const reportPath = resolveReportArtifactPath(cwd);
  const report = await loadReport(reportPath);
  const recordedAt = new Date().toISOString();
  return report.kind === "loaded"
    ? createReportEvidence(report.report, report.reportPath, recordedAt)
    : createUnavailableEvidence(report, recordedAt);
}

export function formatAiqQualityEvidenceJson(evidence: AiqQualityEvidence): string {
  return `${JSON.stringify(evidence, null, 2)}\n`;
}

async function loadReport(reportPath: string): Promise<ReportLoadResult> {
  let contents: string;
  try {
    contents = await readFile(reportPath, "utf8");
  } catch (error) {
    if (isErrorCode(error, "ENOENT")) {
      return { kind: "missing", reportPath };
    }
    return { kind: "malformed", reportPath };
  }

  try {
    const value = JSON.parse(contents) as unknown;
    return isRunResult(value)
      ? { kind: "loaded", report: value, reportPath }
      : { kind: "malformed", reportPath };
  } catch {
    return { kind: "malformed", reportPath };
  }
}
