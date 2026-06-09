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
  it("resolves injected runner language modules from a bounded stage definition", () => {
    const stageDefinition = createCombinedStageDefinition("lint", ["synthetic"]);
    const task: PlannedTask = {
      fileCount: 1,
      files: ["src/example.synthetic"],
      id: "run-1:1:lint",
      stageId: "lint",
    };
    const modules = createRunnerLanguageModuleRegistry([
      {
        id: "synthetic",
        stageHandlers: {
          lint: async (_task) => createStageResult(_task.stageId, "passed"),
        },
      },
    ]);

    runnerExecutionContextStorage.run(createRunnerExecutionContext(process.cwd()), () => {
      const handlers = resolveStageHandlersFromModules(stageDefinition, task, modules);

      expect(handlers).toHaveLength(1);
      expect(handlers[0]?.files).toEqual(["src/example.synthetic"]);
    });
  });
});
