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
  it.skipIf(!hasRustToolchain)(
    "combines Go and Rust metrics without downgrading supported mixed selections",
    async () => {
      const goProject = await createGoFixtureProject("aiq-mixed-go-rust-metrics-runner-");
      const rustProject = await createRustFixtureProject("aiq-mixed-go-rust-metrics-runner-");

      const complexity = await runPlannedTask(
        {
          fileCount: 2,
          files: [goProject.sourceFile, rustProject.sourceFile],
          id: "test:1:complexity-mixed-go-rust",
          stageId: "complexity",
        },
        process.cwd(),
      );
      const maintainability = await runPlannedTask(
        {
          fileCount: 2,
          files: [goProject.sourceFile, rustProject.sourceFile],
          id: "test:1:maintainability-mixed-go-rust",
          stageId: "maintainability",
        },
        process.cwd(),
      );

      expect(complexity.status).toBe("passed");
      expect(complexity.toolRuns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ cacheHit: false, status: "passed", tool: "lizard" }),
          expect.objectContaining({ cacheHit: false, status: "passed", tool: "lizard" }),
        ]),
      );
      expect(maintainability.status).toBe("passed");
      expect(maintainability.notes.join(" ")).toContain("Reused cached");
    },
    20_000,
  );
});
