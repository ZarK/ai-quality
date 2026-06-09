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
  it("fails the CI benchmark gate when a scenario exceeds its budget", async () => {
    const outDir = await mkdtemp(path.join(os.tmpdir(), "aiq-benchmark-"));
    tempDirs.push(outDir);

    await expect(
      runBenchmarkSuiteAndEnforceBudgets({
        cwd: process.cwd(),
        outDir,
        scenarios: [
          {
            budget: {
              maxDurationMs: 0,
              maxStageDurationMs: { lint: 0 },
            },
            description: "Budget gate regression test.",
            fixturePath: path.resolve("test-projects/javascript"),
            id: "budget-gate-failure",
            inputs: ["index.js"],
            kind: "diff-only",
            metadata: {
              languages: ["javascript"],
              scale: "small",
              shape: "single-file",
              tags: ["budget", "javascript"],
            },
            stages: ["lint"],
            profile: "fast",
          },
        ],
      }),
    ).rejects.toThrowError("1 benchmark budget(s) failed.");
  });
});
