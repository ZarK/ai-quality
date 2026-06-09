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
    "prefers the owning solution when multiple ancestor solutions exist",
    async () => {
      const project = await createDotNetCompetingSolutionProject(
        "aiq-dotnet-owning-solution-runner-",
      );

      const result = await withExclusiveDotNet(async () =>
        runPlannedTask(
          {
            fileCount: 2,
            files: [project.sourceFile, project.testFile],
            id: "test:1:unit-dotnet-owning-solution",
            stageId: "unit",
          },
          process.cwd(),
        ),
      );

      expect(result.status).toBe("passed");
      expect(result.toolRuns).toHaveLength(1);
      expect(result.toolRuns[0]).toMatchObject({
        exitCode: 0,
        status: "passed",
        tool: "dotnet-test",
      });
      expect(result.notes[0]).toContain("1 passed, 0 failed");
    },
    90_000,
  );
});
