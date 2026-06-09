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
  it("recognizes mixed-case .BATS files as Bash tests", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "aiq-bash-uppercase-bats-"));
    tempDirs.push(tempDir);

    const batsFile = path.join(tempDir, "example.BATS");
    await writeFile(batsFile, ['@test "passes" {', "  [ 1 -eq 1 ]", "}", ""].join("\n"), "utf8");

    vi.spyOn(ToolRunner.prototype, "resolveBinaryIfAvailable").mockResolvedValue(undefined);

    const result = await runPlannedTask(
      {
        fileCount: 1,
        files: [batsFile],
        id: "test:1:unit-bash-uppercase-bats",
        stageId: "unit",
      },
      process.cwd(),
    );

    expect(result.status).toBe("not_implemented");
    expect(result.notes[0]).toContain("Bats is required for Bash unit");
    expect(result.notes[0]).not.toContain("No Bash tests were found");
    expect(result.toolRuns).toEqual([
      expect.objectContaining({ status: "not_implemented", tool: "bats" }),
    ]);
  });
});
