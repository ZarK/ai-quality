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
  it("runs a real Go fixture through an injected runner registry path", async () => {
    const hasGo = commandAvailable("go");
    const context = await buildEngineContext({
      context: "cli",
      manifest: {
        files: [fixtureGoFile],
        source: "direct",
      },
      mode: "check",
      outDir: path.join(process.cwd(), ".aiq", "out"),
      stages: ["unit"],
      writeArtifacts: false,
    });
    const stageDefinition = createCombinedStageDefinition("unit", ["go"]);
    const goModule = defaultRunnerLanguageModules.byId.get("go");
    if (goModule === undefined) {
      throw new Error("Expected the default Go runner module to exist.");
    }

    const modules = createRunnerLanguageModuleRegistry([goModule]);
    const task: PlannedTask = {
      fileCount: 1,
      files: [fixtureGoFile],
      id: "run-1:1:go-unit",
      stageId: "unit",
    };
    const runnerContext = createRunnerExecutionContext(context);

    const result = await runnerExecutionContextStorage.run(runnerContext, async () => {
      const handlers = resolveStageHandlersFromModules(stageDefinition, task, modules);
      expect(handlers).toHaveLength(1);

      const [handler] = handlers;
      if (handler === undefined) {
        throw new Error("Expected a Go unit handler.");
      }

      return handler.handler(
        { ...task, files: handler.files },
        { cwd: runnerContext.cwd, signal: runnerContext.signal },
      );
    });

    if (!hasGo) {
      expect(result.status).toBe("failed");
      return;
    }

    expect(result.status).toBe("passed");
    expect(result.toolRuns[0]).toMatchObject({ status: "passed", tool: "go-test" });
  }, 30_000);
});
