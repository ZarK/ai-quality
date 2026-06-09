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
  it.skipIf(!hasFullBenchmarkToolchain)(
    "runs the issue 96 benchmark scenarios successfully",
    async () => {
      const outDir = await mkdtemp(path.join(os.tmpdir(), "aiq-benchmark-"));
      tempDirs.push(outDir);

      const { report } = await runBenchmarkSuite({
        cwd: process.cwd(),
        outDir,
        scenarioIds: issue96ScenarioIds,
        scenarios: createDefaultBenchmarkCorpus(path.resolve(process.cwd())),
      });

      expect(report.summary.failedBudgetCount).toBe(0);
      expect(report.summary.scenarioCount).toBe(issue96ScenarioIds.length);
      expect(report.scenarios.every((scenario) => scenario.status === "passed")).toBe(true);
      expect(report.scenarios.every((scenario) => scenario.withinBudget)).toBe(true);
      expect(new Set(report.scenarios.map((scenario) => scenario.id))).toEqual(
        new Set(issue96ScenarioIds),
      );
      expect(
        new Set(
          report.scenarios.find((scenario) => scenario.id === "python-unit-sub-folder-warm")
            ?.manifest.files,
        ),
      ).toEqual(new Set(["tests/test_main.py"]));
      expect(
        report.scenarios.find((scenario) => scenario.id === "javascript-coverage-sub-folder-warm")
          ?.manifest,
      ).toMatchObject({
        inputs: ["src"],
        shape: "sub-folder",
      });
      expect(
        new Set(
          report.scenarios.find((scenario) => scenario.id === "javascript-coverage-sub-folder-warm")
            ?.manifest.files,
        ),
      ).toEqual(new Set(["src/subfolder.js", "src/subfolder.test.js"]));
      expect(
        report.scenarios.find((scenario) => scenario.id === "go-coverage-sub-folder-warm")
          ?.manifest,
      ).toMatchObject({
        inputs: ["pkg"],
        shape: "sub-folder",
      });
      expect(
        new Set(
          report.scenarios.find((scenario) => scenario.id === "go-coverage-sub-folder-warm")
            ?.manifest.files,
        ),
      ).toEqual(new Set(["pkg/fixture/greeter.go", "pkg/fixture/greeter_test.go"]));
    },
    180_000,
  );
});
