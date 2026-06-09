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
  it("runs Stylelint lint and returns structured diagnostics for CSS files", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "aiq-css-lint-runner-"));
    tempDirs.push(tempDir);

    await writeFile(
      path.join(tempDir, ".stylelintrc.json"),
      `${JSON.stringify({ rules: { "color-named": "never" } }, null, 2)}\n`,
      "utf8",
    );

    const badCssFile = path.join(tempDir, "bad.css");
    await writeFile(badCssFile, "a { color: red; }\n", "utf8");

    const result = await runPlannedTask(
      {
        fileCount: 1,
        files: [badCssFile],
        id: "test:1:lint-css",
        stageId: "lint",
      },
      process.cwd(),
    );

    expect(result.status).toBe("failed");
    expect(result.diagnostics[0]).toMatchObject({
      code: "color-named",
      file: badCssFile,
      severity: "error",
      source: "stylelint",
    });
    expect(result.diagnostics[0]?.range).toMatchObject({
      startColumn: 12,
      startLine: 1,
    });
    expect(result.toolRuns[0]).toMatchObject({
      exitCode: 1,
      status: "failed",
      tool: "stylelint",
    });
  });
});
