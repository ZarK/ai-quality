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
  it("resolves Stylelint config from the engine cwd when the file tree has none", async () => {
    const configDir = await mkdtemp(path.join(os.tmpdir(), "aiq-css-lint-cwd-config-"));
    const fileDir = await mkdtemp(path.join(os.tmpdir(), "aiq-css-lint-cwd-files-"));
    tempDirs.push(configDir, fileDir);

    await writeFile(
      path.join(configDir, ".stylelintrc.json"),
      `${JSON.stringify({ rules: { "color-named": "never" } }, null, 2)}\n`,
      "utf8",
    );

    const badCssFile = path.join(fileDir, "bad.css");
    await writeFile(badCssFile, "a { color: red; }\n", "utf8");

    const result = await runPlannedTask(
      {
        fileCount: 1,
        files: [badCssFile],
        id: "test:1:lint-css-cwd-config",
        stageId: "lint",
      },
      configDir,
    );

    expect(result.status).toBe("failed");
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "color-named", file: badCssFile, source: "stylelint" }),
      ]),
    );
  });
});
