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
  it("returns a failed stage result when PSScriptAnalyzer is missing for PowerShell lint", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "aiq-powershell-missing-module-"));
    tempDirs.push(tempDir);

    const powerShellFile = path.join(tempDir, "script.ps1");
    await writeFile(powerShellFile, "Write-Host 'hello'\n", "utf8");

    vi.spyOn(ToolRunner.prototype, "resolveRequiredPowerShellModuleManifest").mockRejectedValue(
      new Error(
        "PSScriptAnalyzer was not detected. Install PSScriptAnalyzer to enable this PowerShell stage.",
      ),
    );

    const result = await runPlannedTask(
      {
        fileCount: 1,
        files: [powerShellFile],
        id: "test:1:lint-powershell-missing-module",
        stageId: "lint",
      },
      process.cwd(),
    );

    expect(result.status).toBe("failed");
    expect(result.notes[0]).toContain("PSScriptAnalyzer was not detected");
    expect(result.diagnostics[0]).toMatchObject({
      file: powerShellFile,
      severity: "error",
      source: "psscriptanalyzer",
    });
    expect(result.toolRuns).toEqual([]);
  });
});
