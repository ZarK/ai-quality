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
  it("reuses cached JavaScript and TypeScript metrics between sloc, complexity, and maintainability", async () => {
    const sloc = await runPlannedTask(
      {
        fileCount: 2,
        files: [fixtureFile, fixtureJavaScriptFile],
        id: "test:1:sloc-js-ts",
        stageId: "sloc",
      },
      process.cwd(),
    );
    const complexity = await runPlannedTask(
      {
        fileCount: 2,
        files: [fixtureFile, fixtureJavaScriptFile],
        id: "test:1:complexity-js-ts",
        stageId: "complexity",
      },
      process.cwd(),
    );
    const maintainability = await runPlannedTask(
      {
        fileCount: 2,
        files: [fixtureFile, fixtureJavaScriptFile],
        id: "test:1:maintainability-js-ts",
        stageId: "maintainability",
      },
      process.cwd(),
    );
    const slocLizardRuns = sloc.toolRuns.filter(
      (toolRun) =>
        toolRun.cacheHit === false &&
        toolRun.exitCode === 0 &&
        toolRun.status === "passed" &&
        toolRun.tool === "lizard",
    );
    const complexityLizardRuns = complexity.toolRuns.filter(
      (toolRun) =>
        toolRun.cacheHit === true &&
        toolRun.exitCode === 0 &&
        toolRun.status === "passed" &&
        toolRun.tool === "lizard",
    );
    const maintainabilityLizardRuns = maintainability.toolRuns.filter(
      (toolRun) =>
        toolRun.cacheHit === true &&
        toolRun.exitCode === 0 &&
        toolRun.status === "passed" &&
        toolRun.tool === "lizard",
    );

    expect(sloc.status).toBe("passed");
    expect(sloc.notes[0]).toContain("JavaScript/TypeScript SLOC:");
    expect(slocLizardRuns).toHaveLength(2);
    expect(complexity.status).toBe("passed");
    expect(complexity.notes[0]).toContain("Shared metrics observed");
    expect(complexity.notes.join(" ")).toContain("Reused cached JavaScript/TypeScript metrics");
    expect(complexityLizardRuns).toHaveLength(2);
    expect(maintainability.status).toBe("passed");
    expect(maintainability.notes.join(" ")).toContain(
      "Reused cached JavaScript/TypeScript metrics",
    );
    expect(maintainabilityLizardRuns).toHaveLength(2);
  });
});
