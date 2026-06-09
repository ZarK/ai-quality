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
  it.skipIf(!hasPythonQualityToolchain)(
    "runs Python typecheck and parses ty GitLab diagnostics",
    async () => {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "aiq-python-typecheck-runner-"));
      tempDirs.push(tempDir);

      const badPythonFile = path.join(tempDir, "bad.py");
      await writeFile(badPythonFile, "value: str = 42\n", "utf8");

      const result = await runPlannedTask(
        {
          fileCount: 1,
          files: [badPythonFile],
          id: "test:1:typecheck-python",
          stageId: "typecheck",
        },
        process.cwd(),
      );

      expect(result.status).toBe("failed");
      expect(result.diagnostics[0]).toMatchObject({
        file: badPythonFile,
        message: expect.stringContaining("Object of type `Literal[42]` is not assignable to `str`"),
        severity: "error",
        source: "ty",
      });
      expect(result.diagnostics[0]?.range).toMatchObject({
        startColumn: 14,
        startLine: 1,
      });
      expect(result.toolRuns[0]).toMatchObject({
        exitCode: 1,
        status: "failed",
        tool: "ty",
      });
    },
  );
});
