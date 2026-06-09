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
  it("includes the issue 96 shape scenarios for targeted languages", () => {
    const corpus = createDefaultBenchmarkCorpus(path.resolve(process.cwd()));
    const scenarioIds = new Set(corpus.map((scenario) => scenario.id));

    expect([...scenarioIds]).toEqual(expect.arrayContaining(Array.from(issue96ScenarioIds)));

    const shapesByLanguage = new Map<string, Set<string>>();
    for (const scenario of corpus) {
      for (const language of scenario.metadata.languages) {
        const shapes = shapesByLanguage.get(language) ?? new Set<string>();
        shapes.add(scenario.metadata.shape);
        shapesByLanguage.set(language, shapes);
      }
    }

    expect(shapesByLanguage.get("javascript")).toEqual(
      new Set(["full-repo", "multi-file", "single-file", "sub-folder"]),
    );
    expect(shapesByLanguage.get("typescript")).toEqual(
      new Set(["full-repo", "multi-file", "single-file", "sub-folder"]),
    );
    expect(shapesByLanguage.get("python")).toEqual(
      new Set(["full-repo", "multi-file", "single-file", "sub-folder"]),
    );
    expect(shapesByLanguage.get("go")).toEqual(
      new Set(["full-repo", "multi-file", "single-file", "sub-folder"]),
    );
    expect(shapesByLanguage.get("rust")).toEqual(
      new Set(["full-repo", "multi-file", "single-file", "sub-folder"]),
    );
    expect(shapesByLanguage.get("dotnet")).toEqual(
      new Set(["full-repo", "multi-file", "single-file"]),
    );
    expect(shapesByLanguage.get("java")).toEqual(
      new Set(["full-repo", "multi-file", "single-file"]),
    );
    expect(shapesByLanguage.get("kotlin")).toEqual(
      new Set(["full-repo", "multi-file", "single-file"]),
    );
  });
});
