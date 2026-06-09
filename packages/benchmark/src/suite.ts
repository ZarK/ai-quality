import { rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { engineVersion, runEngine } from "@tjalve/aiq/engine";
import type { StageId } from "@tjalve/aiq/model";
import { createDefaultBenchmarkCorpus } from "./corpus.js";
import { formatError } from "./errors.js";
import {
  cloneBudget,
  cloneMetadata,
  computeFileCountBand,
  computeLocBand,
  evaluateBudget,
  summarizeBenchmarkReport,
  writeBenchmarkReportArtifact,
} from "./report.js";
import { filterBenchmarkScenarios, normalizeKinds, normalizeStrings } from "./selection.js";
import { benchmarkArtifactVersion, defaultBenchmarkOutDir } from "./types.js";
import type {
  BenchmarkReport,
  BenchmarkScenario,
  BenchmarkScenarioResult,
  RunBenchmarkSuiteOptions,
  RunBenchmarkSuiteResult,
} from "./types.js";
import {
  createScenarioWorkspace,
  resolveScenarioManifest,
  resolveScenarioOutDir,
} from "./workspace.js";

export async function runBenchmarkSuite(
  options: RunBenchmarkSuiteOptions = {},
): Promise<RunBenchmarkSuiteResult> {
  const context = createBenchmarkSuiteContext(options);
  const scenarioResults = await runBenchmarkScenarios(context.scenarios, context.outDir);
  const report = createBenchmarkReport(context.cwd, scenarioResults, options);

  if (options.writeArtifact === false) {
    return { report };
  }

  const artifactPath = await writeBenchmarkReportArtifact(report, context.outDir);
  return { artifactPath, report };
}

function createBenchmarkSuiteContext(options: RunBenchmarkSuiteOptions): {
  cwd: string;
  outDir: string;
  scenarios: BenchmarkScenario[];
} {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const corpusRoot = path.resolve(options.corpusRoot ?? cwd);
  const outDir = path.resolve(cwd, options.outDir ?? defaultBenchmarkOutDir);
  const allScenarios = [...(options.scenarios ?? createDefaultBenchmarkCorpus(corpusRoot))];
  return {
    cwd,
    outDir,
    scenarios: filterBenchmarkScenarios(allScenarios, options),
  };
}

async function runBenchmarkScenarios(
  scenarios: readonly BenchmarkScenario[],
  outDir: string,
): Promise<BenchmarkScenarioResult[]> {
  const scenarioResults: BenchmarkScenarioResult[] = [];
  for (const scenario of scenarios) {
    try {
      scenarioResults.push(await runBenchmarkScenario(scenario, outDir));
    } catch (error) {
      throw new Error(`Benchmark scenario '${scenario.id}' failed: ${formatError(error)}`);
    }
  }
  return scenarioResults;
}

function createBenchmarkReport(
  cwd: string,
  scenarioResults: BenchmarkScenarioResult[],
  options: RunBenchmarkSuiteOptions,
): BenchmarkReport {
  const summary = summarizeBenchmarkReport(scenarioResults);
  return {
    artifactType: "benchmark",
    artifactVersion: benchmarkArtifactVersion,
    cwd,
    engineVersion,
    environment: {
      arch: os.arch(),
      nodeVersion: process.version,
      platform: process.platform,
    },
    generatedAt: new Date().toISOString(),
    primaryMetric: {
      field: "summary.totalDurationMs",
      goal: "minimize",
      unit: "ms",
      value: summary.totalDurationMs,
    },
    scenarios: scenarioResults,
    selection: {
      kinds: normalizeKinds(options.kinds),
      matchedScenarioCount: scenarioResults.length,
      scenarioIds: normalizeStrings(options.scenarioIds),
      tags: normalizeStrings(options.tags),
    },
    summary,
  };
}

export async function runBenchmarkSuiteAndEnforceBudgets(
  options: RunBenchmarkSuiteOptions = {},
): Promise<RunBenchmarkSuiteResult> {
  const result = await runBenchmarkSuite(options);

  if (result.report.summary.failedBudgetCount > 0) {
    throw new Error(`${result.report.summary.failedBudgetCount} benchmark budget(s) failed.`);
  }

  return result;
}

async function runBenchmarkScenario(
  scenario: BenchmarkScenario,
  baseOutDir: string,
): Promise<BenchmarkScenarioResult> {
  validateBenchmarkScenario(scenario);

  const fixturePath = path.resolve(scenario.fixturePath);
  const scenarioOutDir = resolveScenarioOutDir(baseOutDir, scenario.id);
  await rm(scenarioOutDir, { force: true, recursive: true });
  const workspace = await createScenarioWorkspace(fixturePath, scenario.id);
  try {
    const manifest = await resolveScenarioManifest(scenario, workspace.root);
    const warmupRuns = scenario.warmupRuns ?? (scenario.kind === "warm" ? 1 : 0);

    for (let index = 0; index < warmupRuns; index += 1) {
      const warmupResult = await runEngine({
        context: "cli",
        cwd: workspace.root,
        manifest: { files: manifest.absoluteFiles, source: "direct" },
        mode: "check",
        ...(scenario.profile === undefined ? {} : { profile: scenario.profile }),
        stages: scenario.stages,
        writeArtifacts: false,
      });
      if (warmupResult.summary.status !== "passed") {
        throw new Error(
          `Warmup run ${index + 1} finished with status '${warmupResult.summary.status}'.`,
        );
      }
    }

    const startedAt = process.hrtime.bigint();
    const result = await runEngine({
      context: "cli",
      cwd: workspace.root,
      manifest: { files: manifest.absoluteFiles, source: "direct" },
      mode: "check",
      outDir: scenarioOutDir,
      ...(scenario.profile === undefined ? {} : { profile: scenario.profile }),
      stages: scenario.stages,
      writeArtifacts: true,
    });
    if (result.summary.status !== "passed") {
      throw new Error(`Engine run finished with status '${result.summary.status}'.`);
    }
    const durationMs = Number((process.hrtime.bigint() - startedAt) / 1_000_000n);
    const stageDurationsMs = Object.fromEntries(
      result.stages.map((stage) => [stage.stageId, stage.durationMs]),
    ) as Partial<Record<StageId, number>>;
    const budgetFailures = evaluateBudget(durationMs, stageDurationsMs, scenario.budget);

    return {
      artifactDir: scenarioOutDir,
      budget: cloneBudget(scenario.budget),
      budgetFailures,
      cache: {
        hitCount: result.summary.cacheHitCount,
        hitRate: result.summary.cacheHitRate,
        isolation: "fresh-workspace-copy",
        missCount: result.summary.cacheMissCount,
        primed: warmupRuns > 0,
        warmupRuns,
      },
      cacheHitCount: result.summary.cacheHitCount,
      cacheHitRate: result.summary.cacheHitRate,
      cacheMissCount: result.summary.cacheMissCount,
      description: scenario.description,
      diagnosticCount: result.summary.diagnosticCount,
      durationMs,
      engineDurationMs: result.summary.durationMs,
      fixturePath,
      id: scenario.id,
      kind: scenario.kind,
      manifest: {
        fileCount: manifest.relativeFiles.length,
        fileCountBand: computeFileCountBand(manifest.relativeFiles.length),
        files: manifest.relativeFiles,
        inputs: [...scenario.inputs],
        loc: manifest.loc,
        locBand: computeLocBand(manifest.loc),
        shape: scenario.metadata.shape,
      },
      metadata: cloneMetadata(scenario.metadata),
      ...(result.artifacts.metricsPath === undefined
        ? {}
        : { metricsPath: result.artifacts.metricsPath }),
      profile: result.request.selection.profile,
      ...(result.artifacts.reportPath === undefined
        ? {}
        : { reportPath: result.artifacts.reportPath }),
      stageDurationsMs,
      stages: [...scenario.stages],
      status: result.summary.status,
      toolDurationMs: result.summary.toolDurationMs,
      toolRunCount: result.summary.toolRunCount,
      withinBudget: budgetFailures.length === 0,
    };
  } finally {
    await rm(workspace.tempRoot, { force: true, recursive: true });
  }
}

function validateBenchmarkScenario(scenario: BenchmarkScenario): void {
  if (scenario.inputs.length === 0) {
    throw new Error(`Benchmark scenario '${scenario.id}' requires at least one input path.`);
  }

  if (scenario.metadata.languages.length === 0) {
    throw new Error(`Benchmark scenario '${scenario.id}' requires at least one language.`);
  }

  if (scenario.metadata.tags.length === 0) {
    throw new Error(`Benchmark scenario '${scenario.id}' requires at least one tag.`);
  }
}
