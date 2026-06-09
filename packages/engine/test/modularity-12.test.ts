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
  it.skipIf(!hasDotNet10Toolchain)(
    "runs a real dotnet fixture through an injected runner registry path",
    async () => {
      const context = await buildEngineContext({
        context: "cli",
        manifest: {
          files: [fixtureDotNetFile],
          source: "direct",
        },
        mode: "check",
        outDir: path.join(process.cwd(), ".aiq", "out"),
        stages: ["unit"],
        writeArtifacts: false,
      });
      const stageDefinition = createCombinedStageDefinition("unit", ["dotnet"]);
      const dotNetModule = defaultRunnerLanguageModules.byId.get("dotnet");
      if (dotNetModule === undefined) {
        throw new Error("Expected the default dotnet runner module to exist.");
      }

      const modules = createRunnerLanguageModuleRegistry([dotNetModule]);
      const task: PlannedTask = {
        fileCount: 1,
        files: [fixtureDotNetFile],
        id: "run-1:1:dotnet-unit",
        stageId: "unit",
      };
      const runnerContext = createRunnerExecutionContext(context);

      const result = await runnerExecutionContextStorage.run(runnerContext, async () => {
        const handlers = resolveStageHandlersFromModules(stageDefinition, task, modules);
        expect(handlers).toHaveLength(1);

        const [handler] = handlers;
        if (handler === undefined) {
          throw new Error("Expected a dotnet unit handler.");
        }

        return handler.handler(
          { ...task, files: handler.files },
          { cwd: runnerContext.cwd, signal: runnerContext.signal },
        );
      });

      expect(result.status).toBe("passed");
      expect(result.toolRuns[0]).toMatchObject({ status: "passed", tool: "dotnet-test" });
    },
    120_000,
  );
});
