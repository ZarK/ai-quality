import { describe, expect, it, vi } from "vitest";
import {
  os,
  path,
  buildEngineContext,
  buildProjectGraph,
  buildProjectGraphWithModules,
  combineStageResults,
  commandAvailable,
  createCombinedStageDefinition,
  createGraphLanguageModuleRegistry,
  createNoopStageResult,
  createNotImplementedStageResult,
  createRunnerExecutionContext,
  createRunnerLanguageModuleRegistry,
  createStageResult,
  createTempFile,
  defaultGraphLanguageModules,
  defaultRunnerLanguageModules,
  defaultStageDefinitions,
  execFileSync,
  fixtureBashFile,
  fixtureDotNetFile,
  fixtureGoFile,
  fixtureJavaMavenFile,
  fixturePowerShellFile,
  fixturePythonConfigFile,
  fixtureRustFile,
  fixtureTerraformFile,
  hasDotNet10Toolchain,
  hasGoToolchain,
  hasMavenToolchain,
  hasPowerShellPesterToolchain,
  hasPythonQualityToolchain,
  hasRustToolchain,
  mkdir,
  mkdtemp,
  normalizeFileManifest,
  resolveStageHandlersFromModules,
  rm,
  runnerExecutionContextStorage,
  tempDirs,
  writeFile,
} from "./modularity-test-helpers.js";

describe("engine modular authoring path", () => {
  it("combines stage results with canonical precedence and noop collapse", () => {
    expect(combineStageResults("lint", [createNoopStageResult("lint", "skip")])).toEqual(
      createNoopStageResult("lint", "No supported files were selected for lint."),
    );

    expect(
      combineStageResults("lint", [
        createStageResult("lint", "not_implemented"),
        createStageResult("lint", "passed"),
      ]).status,
    ).toBe("not_implemented");

    expect(
      combineStageResults("lint", [
        createNotImplementedStageResult("lint"),
        createStageResult("lint", "failed"),
      ]).status,
    ).toBe("failed");

    expect(
      combineStageResults("unit", [
        {
          ...createStageResult("unit", "passed"),
          toolRuns: [
            {
              args: [],
              cacheHit: false,
              durationMs: 1,
              status: "passed",
              tool: "vitest",
            },
          ],
        },
        createNotImplementedStageResult(
          "unit",
          "No supported JavaScript or TypeScript test runner was detected for unit in: packages/example.",
        ),
      ]).status,
    ).toBe("passed");

    expect(
      combineStageResults("lint", [
        {
          ...createStageResult("lint", "passed"),
          toolRuns: [
            {
              args: [],
              cacheHit: false,
              durationMs: 1,
              status: "passed",
              tool: "json-lint",
            },
          ],
        },
        createNotImplementedStageResult(
          "lint",
          "Install 'terraform' to enable Terraform validation.",
        ),
      ]).status,
    ).toBe("not_implemented");

    expect(
      combineStageResults("sloc", [
        {
          ...createStageResult("sloc", "passed"),
          toolRuns: [
            {
              args: [],
              cacheHit: false,
              durationMs: 1,
              status: "passed",
              tool: "lizard",
            },
          ],
        },
        createNotImplementedStageResult(
          "sloc",
          "Stage 'sloc' is currently implemented only for Python, JavaScript, TypeScript, C#, Go, Rust, Java, and Kotlin files in the rewrite foundation slice.",
        ),
      ]).status,
    ).toBe("passed");
  });
});
