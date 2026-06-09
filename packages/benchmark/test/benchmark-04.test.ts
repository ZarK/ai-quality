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
  it("filters benchmark scenarios by id, kind, and tag", () => {
    const corpus = createDefaultBenchmarkCorpus(path.resolve(process.cwd()));

    const filtered = filterBenchmarkScenarios(corpus, {
      kinds: ["warm"],
      scenarioIds: ["typescript-metrics-multi-file-warm", "python-quality-full-repo-cold"],
      tags: ["ci"],
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe("typescript-metrics-multi-file-warm");
  });
});
