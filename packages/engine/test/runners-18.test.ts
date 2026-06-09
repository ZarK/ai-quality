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
  it("passes the resolved Python interpreter to ty", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "aiq-python-typecheck-command-"));
    tempDirs.push(tempDir);

    const pythonFile = path.join(tempDir, "main.py");
    await writeFile(pythonFile, "value: str = 'ok'\n", "utf8");

    const toolRunner = new ToolRunner();
    const runSpy = vi.spyOn(toolRunner, "run").mockResolvedValue({
      durationMs: 5,
      exitCode: 0,
      finishedAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      stderr: "",
      stdout: "[]",
    });

    const pythonCommand = process.platform === "win32" ? "python" : "python3";
    const tyCommand = process.platform === "win32" ? "ty.exe" : "ty";

    vi.spyOn(toolRunner, "resolveInstalledBinary").mockImplementation(async (commandName) => {
      if (commandName === pythonCommand) {
        return "/tmp/fake-python";
      }

      if (commandName === tyCommand) {
        return "/tmp/fake-ty";
      }

      return undefined;
    });

    const engineContext = withToolRunnerOverride(
      await buildEngineContext({
        context: "cli",
        manifest: {
          files: [pythonFile],
          source: "direct",
        },
        mode: "check",
        outDir: tempDir,
        stages: ["typecheck"],
      }),
      toolRunner,
    );

    const result = await runPlannedTask(
      {
        fileCount: 1,
        files: [pythonFile],
        id: "test:1:typecheck-python-command",
        stageId: "typecheck",
      },
      engineContext,
    );

    expect(result.status).toBe("passed");
    expect(runSpy).toHaveBeenCalledWith(
      "/tmp/fake-ty",
      [
        "check",
        "--python",
        "/tmp/fake-python",
        "--output-format",
        "gitlab",
        "--no-progress",
        "--color",
        "never",
        pythonFile,
      ],
      expect.objectContaining({ cwd: tempDir }),
    );
  });
});
