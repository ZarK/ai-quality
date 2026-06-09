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
  it("returns a failed stage result when a later selected PowerShell format file cannot be read", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "aiq-powershell-missing-format-file-"));
    tempDirs.push(tempDir);

    const existingFile = path.join(tempDir, "existing.ps1");
    const missingFile = path.join(tempDir, "missing.ps1");
    await writeFile(existingFile, "Write-Host 'hello'\n", "utf8");
    await writeFile(missingFile, "Write-Host 'missing'\n", "utf8");
    await rm(missingFile);

    const result = await runPlannedTask(
      {
        fileCount: 2,
        files: [existingFile, missingFile],
        id: "test:1:format-powershell-missing-file",
        stageId: "format",
      },
      process.cwd(),
    );

    expect(result.status).toBe("failed");
    expect(result.notes[0]).toContain("ENOENT");
    expect(result.diagnostics[0]).toMatchObject({
      file: missingFile,
      severity: "error",
      source: "invoke-formatter",
    });
    expect(result.toolRuns).toEqual([]);
  });
});
