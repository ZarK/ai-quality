import { describe, expect, it, vi } from "vitest";
import {
  os,
  path,
  ToolRunner,
  binaries,
  buildEngineContext,
  chmod,
  collectJavaScriptAndTypeScriptFiles,
  commandAvailable,
  cp,
  createBashFixtureProject,
  createCustomJavaScriptE2eProject,
  createCustomJavaScriptRunnerProject,
  createCustomPythonRunnerProject,
  createDotNetCompetingSolutionProject,
  createDotNetFixtureProject,
  createGoFixtureProject,
  createJavaMavenFixtureProject,
  createKotlinGradleFixtureProject,
  createPowerShellFixtureProject,
  createRustFixtureProject,
  execFileSync,
  fixtureBashRoot,
  fixtureDotNetRoot,
  fixtureFile,
  fixtureGoRoot,
  fixtureJavaMavenRoot,
  fixtureJavaScriptFile,
  fixtureKotlinGradleRoot,
  fixturePowerShellRoot,
  fixturePythonConfigFile,
  fixturePythonFile,
  fixtureRustRoot,
  fixtureTsconfig,
  fixtureTypeScriptPackageJson,
  hasDotNet10Toolchain,
  hasGoToolchain,
  hasGradleToolchain,
  hasMavenToolchain,
  hasPowerShellPesterToolchain,
  hasPythonQualityToolchain,
  hasRustCoverageToolchain,
  hasRustToolchain,
  lintFailureFixtureFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  resolveCommandPath,
  resolvePowerShellModuleAvailable,
  rm,
  runEngine,
  runPlannedTask,
  tempDirs,
  vitestCliPath,
  withExclusiveDotNet,
  withExclusiveRust,
  withExclusiveToolLock,
  withPathedPythonShim,
  withToolRunnerOverride,
  writeFile,
} from "./runners-test-helpers.js";

describe("engine runners", () => {
  it.skipIf(!hasDotNet10Toolchain)(
    "combines C# and Go metrics without downgrading supported mixed selections",
    async () => {
      const dotNetProject = await createDotNetFixtureProject("aiq-mixed-dotnet-go-metrics-runner-");
      const goProject = await createGoFixtureProject("aiq-mixed-dotnet-go-metrics-runner-");

      const complexity = await runPlannedTask(
        {
          fileCount: 2,
          files: [dotNetProject.sourceFile, goProject.sourceFile],
          id: "test:1:complexity-mixed-dotnet-go",
          stageId: "complexity",
        },
        process.cwd(),
      );
      const maintainability = await runPlannedTask(
        {
          fileCount: 2,
          files: [dotNetProject.sourceFile, goProject.sourceFile],
          id: "test:1:maintainability-mixed-dotnet-go",
          stageId: "maintainability",
        },
        process.cwd(),
      );

      expect(complexity.status).toBe("passed");
      expect(complexity.toolRuns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            cacheHit: false,
            status: "passed",
            tool: "aiq-csharp-metrics",
          }),
          expect.objectContaining({ cacheHit: false, status: "passed", tool: "lizard" }),
        ]),
      );
      expect(maintainability.status).toBe("passed");
      expect(maintainability.toolRuns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ cacheHit: true, status: "passed", tool: "aiq-csharp-metrics" }),
          expect.objectContaining({ cacheHit: true, status: "passed", tool: "lizard" }),
        ]),
      );
    },
    20_000,
  );
});
