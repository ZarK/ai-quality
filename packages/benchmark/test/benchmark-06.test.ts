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
  it.skipIf(!hasTaggedCiBenchmarkToolchain)(
    "runs the tagged CI benchmark scenarios successfully",
    async () => {
      const outDir = await mkdtemp(path.join(os.tmpdir(), "aiq-benchmark-"));
      tempDirs.push(outDir);

      const { report } = await runBenchmarkSuite({
        cwd: process.cwd(),
        outDir,
        tags: ["ci"],
        scenarios: createDefaultBenchmarkCorpus(path.resolve(process.cwd())),
      });

      expect(report.summary.failedBudgetCount).toBe(0);
      expect(report.scenarios.map((scenario) => scenario.id)).toEqual([
        "javascript-lint-single-file-cold",
        "typescript-metrics-multi-file-warm",
        "typescript-unit-coverage-full-repo-warm",
        "typescript-format-full-repo-diff",
        "python-quality-full-repo-cold",
        "python-lint-full-repo-warm",
        "go-lint-full-repo-cold",
      ]);
      expect(report.scenarios.every((scenario) => scenario.status === "passed")).toBe(true);
      expect(report.selection.tags).toEqual(["ci"]);
      expect(
        report.scenarios.find((scenario) => scenario.id === "python-quality-full-repo-cold")
          ?.manifest.inputs,
      ).toEqual(["main.py", "tests/test_main.py", "tests"]);
      expect(
        new Set(
          report.scenarios.find((scenario) => scenario.id === "python-quality-full-repo-cold")
            ?.manifest.files,
        ),
      ).toEqual(new Set(["main.py", "tests/test_main.py"]));
    },
    20_000,
  );
});
