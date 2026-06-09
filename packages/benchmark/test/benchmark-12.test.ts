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
  it("keeps benchmark artifacts out of the source fixture tree", async () => {
    const outDir = await mkdtemp(path.join(os.tmpdir(), "aiq-benchmark-"));
    tempDirs.push(outDir);

    await expect(
      access(path.join(benchmarkTypeScriptLargeFixturePath, ".aiq")),
    ).rejects.toMatchObject({
      code: "ENOENT",
    });

    await runBenchmarkSuite({
      cwd: process.cwd(),
      outDir,
      scenarioIds: ["typescript-metrics-multi-file-warm"],
      scenarios: createDefaultBenchmarkCorpus(path.resolve(process.cwd())),
    });

    await expect(
      access(path.join(benchmarkTypeScriptLargeFixturePath, ".aiq")),
    ).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});
