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
    "runs dotnet style lint and returns structured diagnostics for C# files",
    async () => {
      const project = await createDotNetFixtureProject("aiq-dotnet-lint-runner-");

      await writeFile(
        project.sourceFile,
        [
          "namespace DotNetFixture;",
          "",
          "public static class Greeter",
          "{",
          "    public static string CreateGreeting(string name)",
          "    {",
          "        string trimmedName = name.Trim();",
          '        return $"Hello, {trimmedName}!";',
          "    }",
          "}",
          "",
        ].join("\n"),
        "utf8",
      );

      const result = await withExclusiveDotNet(async () =>
        runPlannedTask(
          {
            fileCount: 1,
            files: [project.sourceFile],
            id: "test:1:lint-dotnet",
            stageId: "lint",
          },
          process.cwd(),
        ),
      );

      expect(result.status).toBe("failed");
      expect(result.diagnostics[0]).toMatchObject({
        code: "IDE0007",
        file: project.sourceFile,
        severity: "error",
        source: "dotnet-format",
      });
      expect(result.toolRuns[0]).toMatchObject({
        status: "failed",
        tool: "dotnet-format-style",
      });
    },
    90_000,
  );
});
