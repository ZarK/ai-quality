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
  it("fails fast when the engine returns a non-passing warmup result", async () => {
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
            description: "Failing warmup regression test.",
            fixturePath: lintFailureFixturePath,
            id: "warmup-failure",
            inputs: ["src/lint-failure.ts"],
            kind: "warm",
            metadata: {
              languages: ["typescript"],
              scale: "small",
              shape: "single-file",
              tags: ["lint", "typescript", "warmup"],
            },
            profile: "fast",
            stages: ["lint"],
            warmupRuns: 1,
          },
        ],
      }),
    ).rejects.toThrowError(
      "Benchmark scenario 'warmup-failure' failed: Warmup run 1 finished with status 'failed'.",
    );
  });
});
