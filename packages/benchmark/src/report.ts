import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { StageId } from "@tjalve/aiq/model";
import { formatError } from "./errors.js";
import type {
  BenchmarkBudget,
  BenchmarkReport,
  BenchmarkReportSummary,
  BenchmarkScaleBand,
  BenchmarkScenarioMetadata,
  BenchmarkScenarioResult,
} from "./types.js";
import { defaultBenchmarkOutDir } from "./types.js";

export function formatBenchmarkReportAsJson(report: BenchmarkReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function formatBenchmarkReportAsText(report: BenchmarkReport): string {
  const lines = [
    "AIQ bench",
    `Scenarios: ${report.summary.scenarioCount}`,
    `Primary metric: ${report.primaryMetric.field}=${report.primaryMetric.value}ms (${report.primaryMetric.goal})`,
    `Budgets: ${report.summary.passedBudgetCount} passed, ${report.summary.failedBudgetCount} failed`,
    `Input totals: ${report.summary.totalFileCount} files, ${report.summary.totalLoc} LOC`,
  ];

  for (const scenario of report.scenarios) {
    lines.push(
      `- ${scenario.id}: ${scenario.status}, ${scenario.durationMs}ms, ${scenario.manifest.fileCount} files, ${scenario.manifest.loc} LOC, budget=${scenario.withinBudget ? "passed" : "failed"}`,
    );
    lines.push(
      `  kind=${scenario.kind}; shape=${scenario.manifest.shape}; languages=${scenario.metadata.languages.join(",")}; stages=${scenario.stages.join(",")}`,
    );
    if (scenario.budgetFailures.length > 0) {
      lines.push(`  budget failures: ${scenario.budgetFailures.join("; ")}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

export function resolveBenchmarkArtifactPath(
  root: string,
  outDir = defaultBenchmarkOutDir,
): string {
  return path.join(path.resolve(root, outDir), "aiq.benchmark.json");
}

export async function writeBenchmarkReportArtifact(
  report: BenchmarkReport,
  outDir = defaultBenchmarkOutDir,
): Promise<string> {
  const targetDir = path.resolve(report.cwd, outDir);
  const artifactPath = resolveBenchmarkArtifactPath(report.cwd, outDir);
  try {
    await mkdir(targetDir, { recursive: true });
    await writeFile(artifactPath, formatBenchmarkReportAsJson(report), "utf8");
  } catch (error) {
    throw new Error(`Failed to write benchmark artifact at ${artifactPath}: ${formatError(error)}`);
  }

  return artifactPath;
}

export function cloneBudget(budget: BenchmarkBudget): BenchmarkBudget {
  return {
    maxDurationMs: budget.maxDurationMs,
    ...(budget.maxStageDurationMs === undefined
      ? {}
      : { maxStageDurationMs: { ...budget.maxStageDurationMs } }),
  };
}

export function cloneMetadata(metadata: BenchmarkScenarioMetadata): BenchmarkScenarioMetadata {
  return {
    languages: [...metadata.languages],
    scale: metadata.scale,
    shape: metadata.shape,
    tags: [...metadata.tags],
  };
}

export function evaluateBudget(
  durationMs: number,
  stageDurationsMs: Partial<Record<StageId, number>>,
  budget: BenchmarkBudget,
): string[] {
  const failures: string[] = [];

  if (durationMs > budget.maxDurationMs) {
    failures.push(`total duration ${durationMs}ms exceeded budget ${budget.maxDurationMs}ms`);
  }

  const stageBudget = budget.maxStageDurationMs;
  if (stageBudget !== undefined) {
    for (const [stageId, maxDurationMs] of Object.entries(stageBudget) as Array<
      [StageId, number]
    >) {
      const duration = stageDurationsMs[stageId];
      if (duration !== undefined && duration > maxDurationMs) {
        failures.push(`${stageId} duration ${duration}ms exceeded budget ${maxDurationMs}ms`);
      }
    }
  }

  return failures;
}

export function summarizeBenchmarkReport(
  scenarios: readonly BenchmarkScenarioResult[],
): BenchmarkReportSummary {
  const failedBudgetCount = scenarios.filter((scenario) => !scenario.withinBudget).length;

  return {
    failedBudgetCount,
    passedBudgetCount: scenarios.length - failedBudgetCount,
    scenarioCount: scenarios.length,
    totalDurationMs: scenarios.reduce((total, scenario) => total + scenario.durationMs, 0),
    totalFileCount: scenarios.reduce((total, scenario) => total + scenario.manifest.fileCount, 0),
    totalLoc: scenarios.reduce((total, scenario) => total + scenario.manifest.loc, 0),
  };
}

export function computeFileCountBand(fileCount: number): BenchmarkScaleBand {
  if (fileCount <= 3) {
    return "small";
  }

  if (fileCount <= 15) {
    return "medium";
  }

  return "large";
}

export function computeLocBand(loc: number): BenchmarkScaleBand {
  if (loc <= 120) {
    return "small";
  }

  if (loc <= 600) {
    return "medium";
  }

  return "large";
}
