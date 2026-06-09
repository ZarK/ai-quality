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
  it("invalidates cached C# metrics when the file contents change", async () => {
    const project = await createDotNetFixtureProject("aiq-dotnet-metrics-refresh-");

    await writeFile(
      project.sourceFile,
      [
        "namespace DotNetFixture;",
        "",
        "public static class Greeter",
        "{",
        "    public static int Score(bool flag)",
        "    {",
        "        return flag ? 1 : 0;",
        "    }",
        "}",
        "",
      ].join("\n"),
      "utf8",
    );

    const firstComplexity = await runPlannedTask(
      {
        fileCount: 1,
        files: [project.sourceFile],
        id: "test:1:complexity-dotnet-invalidate:first",
        stageId: "complexity",
      },
      process.cwd(),
    );

    await writeFile(
      project.sourceFile,
      [
        "namespace DotNetFixture;",
        "",
        "public static class Greeter",
        "{",
        "    public static int Score(bool flag, int value)",
        "    {",
        "        if (flag)",
        "        {",
        "            return value > 1 ? value : 1;",
        "        }",
        "",
        "        return 0;",
        "    }",
        "}",
        "",
      ].join("\n"),
      "utf8",
    );

    const secondComplexity = await runPlannedTask(
      {
        fileCount: 1,
        files: [project.sourceFile],
        id: "test:1:complexity-dotnet-invalidate:second",
        stageId: "complexity",
      },
      process.cwd(),
    );

    expect(firstComplexity.status).toBe("passed");
    expect(firstComplexity.notes[0]).toContain("C# complexity max: 2");
    expect(firstComplexity.toolRuns[0]).toMatchObject({
      cacheHit: false,
      exitCode: 0,
      status: "passed",
      tool: "aiq-csharp-metrics",
    });
    expect(secondComplexity.status).toBe("passed");
    expect(secondComplexity.notes[0]).toContain("C# complexity max: 3");
    expect(secondComplexity.toolRuns[0]).toMatchObject({
      cacheHit: false,
      exitCode: 0,
      status: "passed",
      tool: "aiq-csharp-metrics",
    });
  }, 20_000);
});
