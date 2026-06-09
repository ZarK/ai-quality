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
  it("reuses cached C# metrics between sloc, complexity, and maintainability", async () => {
    const project = await createDotNetFixtureProject("aiq-dotnet-metrics-runner-");

    const sloc = await runPlannedTask(
      {
        fileCount: 1,
        files: [project.sourceFile],
        id: "test:1:sloc-dotnet",
        stageId: "sloc",
      },
      process.cwd(),
    );
    const complexity = await runPlannedTask(
      {
        fileCount: 1,
        files: [project.sourceFile],
        id: "test:1:complexity-dotnet",
        stageId: "complexity",
      },
      process.cwd(),
    );
    const maintainability = await runPlannedTask(
      {
        fileCount: 1,
        files: [project.sourceFile],
        id: "test:1:maintainability-dotnet",
        stageId: "maintainability",
      },
      process.cwd(),
    );

    expect(sloc.status).toBe("passed");
    expect(sloc.notes[0]).toContain("C# SLOC:");
    expect(sloc.toolRuns[0]).toMatchObject({
      cacheHit: false,
      exitCode: 0,
      status: "passed",
      tool: "aiq-csharp-metrics",
    });
    expect(complexity.status).toBe("passed");
    expect(complexity.notes[0]).toContain("Shared metrics observed");
    expect(complexity.notes.join(" ")).toContain("Reused cached C# metrics");
    expect(complexity.toolRuns[0]).toMatchObject({
      cacheHit: true,
      exitCode: 0,
      status: "passed",
      tool: "aiq-csharp-metrics",
    });
    expect(maintainability.status).toBe("passed");
    expect(maintainability.notes.join(" ")).toContain("Reused cached C# metrics");
    expect(maintainability.toolRuns[0]).toMatchObject({
      cacheHit: true,
      exitCode: 0,
      status: "passed",
      tool: "aiq-csharp-metrics",
    });
  }, 20_000);
});
