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
  it("records shared metrics cache reuse for warm multi-file scenarios", async () => {
    const outDir = await mkdtemp(path.join(os.tmpdir(), "aiq-benchmark-"));
    tempDirs.push(outDir);

    const { report } = await runBenchmarkSuite({
      cwd: process.cwd(),
      outDir,
      scenarioIds: ["typescript-metrics-multi-file-warm"],
      scenarios: createDefaultBenchmarkCorpus(path.resolve(process.cwd())),
    });

    expect(report.summary.failedBudgetCount).toBe(0);
    expect(report.scenarios[0]).toMatchObject({
      cacheHitCount: 3,
      cacheMissCount: 0,
      id: "typescript-metrics-multi-file-warm",
      kind: "warm",
      status: "passed",
      withinBudget: true,
    });
    expect(report.scenarios[0]?.manifest).toMatchObject({
      fileCount: 4,
      shape: "multi-file",
    });
    expect(report.scenarios[0]?.stages).toEqual(["sloc", "complexity", "maintainability"]);
  });
});
