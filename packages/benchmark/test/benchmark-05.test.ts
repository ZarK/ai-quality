import { describe, expect, it, vi } from "vitest";
import {
  os,
  path,
  access,
  benchmarkTypeScriptLargeFixturePath,
  createDefaultBenchmarkCorpus,
  filterBenchmarkScenarios,
  formatBenchmarkReportAsJson,
  formatBenchmarkReportAsText,
  hasDotNet10Toolchain,
  hasFullBenchmarkToolchain,
  hasGoToolchain,
  hasGradleToolchain,
  hasMavenToolchain,
  hasPythonQualityToolchain,
  hasRustToolchain,
  hasTaggedCiBenchmarkToolchain,
  issue96ScenarioIds,
  lintFailureFixturePath,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  runBenchmarkSuite,
  runBenchmarkSuiteAndEnforceBudgets,
  tempDirs,
  writeFile,
} from "./benchmark-test-helpers.js";

describe("benchmark harness", () => {
  it("writes stable JSON benchmark output with a primary metric and manifest metadata", async () => {
    const outDir = await mkdtemp(path.join(os.tmpdir(), "aiq-benchmark-"));
    tempDirs.push(outDir);

    const { artifactPath, report } = await runBenchmarkSuite({
      cwd: process.cwd(),
      outDir,
      scenarios: [
        {
          budget: {
            maxDurationMs: 45_000,
            maxStageDurationMs: { typecheck: 45_000 },
          },
          description: "TypeScript fixture typecheck benchmark.",
          fixturePath: path.resolve("test-projects/typescript"),
          id: "typescript-typecheck",
          inputs: ["src/index.ts"],
          kind: "warm",
          metadata: {
            languages: ["typescript"],
            scale: "small",
            shape: "single-file",
            tags: ["test", "typecheck", "typescript"],
          },
          profile: "standard",
          stages: ["typecheck"],
          warmupRuns: 1,
        },
      ],
    });

    if (artifactPath === undefined) {
      throw new Error("Expected benchmark artifact path.");
    }

    expect(report.artifactType).toBe("benchmark");
    expect(report.artifactVersion).toBe(2);
    expect(report.primaryMetric).toMatchObject({
      field: "summary.totalDurationMs",
      goal: "minimize",
      unit: "ms",
      value: report.summary.totalDurationMs,
    });
    expect(report.summary.scenarioCount).toBe(1);
    expect(report.summary.failedBudgetCount).toBe(0);
    expect(report.scenarios[0]?.manifest).toMatchObject({
      fileCount: 1,
      files: ["src/index.ts"],
      inputs: ["src/index.ts"],
      shape: "single-file",
    });
    expect(report.scenarios[0]?.cache).toMatchObject({
      isolation: "fresh-workspace-copy",
      primed: true,
      warmupRuns: 1,
    });
    expect(report.scenarios[0]?.metricsPath).toBeDefined();
    expect(report.scenarios[0]?.reportPath).toBeDefined();

    const artifactJson = JSON.parse(await readFile(artifactPath, "utf8")) as {
      artifactType: string;
      artifactVersion: number;
      primaryMetric: { field: string; goal: string; unit: string };
      scenarios: Array<{
        id: string;
        manifest: { fileCount: number; shape: string };
        withinBudget: boolean;
      }>;
      summary: { failedBudgetCount: number; scenarioCount: number };
    };
    expect(artifactJson.artifactType).toBe("benchmark");
    expect(artifactJson.artifactVersion).toBe(2);
    expect(artifactJson.primaryMetric).toMatchObject({
      field: "summary.totalDurationMs",
      goal: "minimize",
      unit: "ms",
    });
    expect(artifactJson.summary.scenarioCount).toBe(1);
    expect(artifactJson.summary.failedBudgetCount).toBe(0);
    expect(artifactJson.scenarios[0]).toMatchObject({
      id: "typescript-typecheck",
      manifest: {
        fileCount: 1,
        shape: "single-file",
      },
      withinBudget: true,
    });
    expect(formatBenchmarkReportAsJson(report)).toContain('"primaryMetric"');
    expect(formatBenchmarkReportAsText(report)).toContain(
      "Primary metric: summary.totalDurationMs=",
    );
  });
});
