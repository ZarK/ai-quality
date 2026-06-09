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
  it("runs PowerShell lint successfully across multiple selected files", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "aiq-powershell-lint-success-"));
    tempDirs.push(tempDir);

    const firstFile = path.join(tempDir, "first.ps1");
    const secondFile = path.join(tempDir, "second.ps1");
    await Promise.all([
      writeFile(firstFile, "Write-Host 'first'\n", "utf8"),
      writeFile(secondFile, "Write-Host 'second'\n", "utf8"),
    ]);

    const toolRunner = new ToolRunner();
    vi.spyOn(toolRunner, "resolveRequiredPowerShellModuleManifest").mockResolvedValue(
      "/tmp/PSScriptAnalyzer.psd1",
    );
    const runSpy = vi
      .spyOn(toolRunner, "runPowerShellScript")
      .mockImplementation(async (script) => {
        expect(script).toContain("$results = foreach ($path in $paths) {");
        expect(script).toContain("Invoke-ScriptAnalyzer -Path $path");
        expect(script).not.toContain("Invoke-ScriptAnalyzer -Path $paths");
        expect(script).toContain(firstFile);
        expect(script).toContain(secondFile);

        const timestamp = new Date().toISOString();
        return {
          durationMs: 5,
          exitCode: 0,
          finishedAt: timestamp,
          startedAt: timestamp,
          stderr: "",
          stdout: "[]",
        };
      });

    const engineContext = withToolRunnerOverride(
      await buildEngineContext({
        context: "cli",
        manifest: {
          files: [firstFile, secondFile],
          source: "direct",
        },
        mode: "check",
        outDir: tempDir,
        stages: ["lint"],
      }),
      toolRunner,
    );

    const result = await runPlannedTask(
      {
        fileCount: 2,
        files: [firstFile, secondFile],
        id: "test:1:lint-powershell-success-multi-file",
        stageId: "lint",
      },
      engineContext,
    );

    expect(result.status).toBe("passed");
    expect(result.diagnostics).toEqual([]);
    expect(result.notes).toEqual(["PSScriptAnalyzer passed."]);
    expect(runSpy).toHaveBeenCalledOnce();
    expect(result.toolRuns[0]).toMatchObject({
      exitCode: 0,
      status: "passed",
      tool: "psscriptanalyzer",
    });
  });
});
