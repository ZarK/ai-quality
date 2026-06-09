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
  it("creates a default corpus with rewrite-grade language, stage, kind, and shape coverage", () => {
    const corpus = createDefaultBenchmarkCorpus(path.resolve(process.cwd()));

    expect(corpus).toHaveLength(98);
    expect(new Set(corpus.map((scenario) => scenario.kind))).toEqual(
      new Set(["cold", "diff-only", "warm"]),
    );
    expect(new Set(corpus.map((scenario) => scenario.metadata.shape))).toEqual(
      new Set(["single-file", "multi-file", "sub-folder", "full-repo"]),
    );
    expect(new Set(corpus.flatMap((scenario) => scenario.stages))).toEqual(
      new Set([
        "lint",
        "format",
        "typecheck",
        "unit",
        "sloc",
        "complexity",
        "maintainability",
        "coverage",
        "security",
      ]),
    );
    expect(new Set(corpus.flatMap((scenario) => scenario.metadata.languages))).toEqual(
      new Set([
        "javascript",
        "typescript",
        "python",
        "terraform",
        "hcl",
        "go",
        "rust",
        "dotnet",
        "java",
        "kotlin",
        "bash",
        "powershell",
        "html",
        "css",
        "yaml",
        "sql",
        "documents",
      ]),
    );
  });
});
