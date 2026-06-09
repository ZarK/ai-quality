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
  it("rejects invalid benchmark scenario ids before creating artifact paths", async () => {
    const outDir = await mkdtemp(path.join(os.tmpdir(), "aiq-benchmark-"));
    tempDirs.push(outDir);

    await expect(
      runBenchmarkSuite({
        cwd: process.cwd(),
        outDir,
        scenarios: [
          {
            budget: {
              maxDurationMs: 20_000,
              maxStageDurationMs: { lint: 20_000 },
            },
            description: "Invalid scenario id regression test.",
            fixturePath: path.resolve("test-projects/javascript"),
            id: "../escape",
            inputs: ["index.js"],
            kind: "diff-only",
            metadata: {
              languages: ["javascript"],
              scale: "small",
              shape: "single-file",
              tags: ["invalid", "javascript"],
            },
            profile: "fast",
            stages: ["lint"],
          },
        ],
      }),
    ).rejects.toThrowError(
      "Benchmark scenario '../escape' failed: Invalid benchmark scenario id '../escape'.",
    );
  });
});
