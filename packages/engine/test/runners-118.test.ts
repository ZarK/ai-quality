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
  it("returns a failed stage result when Bash binary lookup hits an unexpected error", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "aiq-bash-lookup-error-"));
    tempDirs.push(tempDir);

    const batsFile = path.join(tempDir, "example.BATS");
    await writeFile(batsFile, ['@test "passes" {', "  [ 1 -eq 1 ]", "}", ""].join("\n"), "utf8");

    vi.spyOn(ToolRunner.prototype, "resolveBinaryIfAvailable").mockRejectedValue(
      new Error("lookup exploded"),
    );

    const result = await runPlannedTask(
      {
        fileCount: 1,
        files: [batsFile],
        id: "test:1:unit-bash-lookup-error",
        stageId: "unit",
      },
      process.cwd(),
    );

    expect(result.status).toBe("failed");
    expect(result.notes[0]).toContain("lookup exploded");
    expect(result.diagnostics[0]).toMatchObject({
      file: batsFile,
      severity: "error",
      source: "bats",
    });
    expect(result.toolRuns).toEqual([]);
  });
});
