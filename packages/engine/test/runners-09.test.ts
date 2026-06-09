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
  it("prefers CSS lint failures over not_implemented when only some files lack Stylelint config", async () => {
    const configuredDir = await mkdtemp(path.join(os.tmpdir(), "aiq-css-lint-configured-"));
    const unconfiguredDir = await mkdtemp(path.join(os.tmpdir(), "aiq-css-lint-unconfigured-"));
    tempDirs.push(configuredDir, unconfiguredDir);

    await writeFile(
      path.join(configuredDir, ".stylelintrc.json"),
      `${JSON.stringify({ rules: { "color-named": "never" } }, null, 2)}\n`,
      "utf8",
    );

    const badCssFile = path.join(configuredDir, "bad.css");
    const plainCssFile = path.join(unconfiguredDir, "plain.css");
    await writeFile(badCssFile, "a { color: red; }\n", "utf8");
    await writeFile(plainCssFile, "b { color: red; }\n", "utf8");

    const result = await runPlannedTask(
      {
        fileCount: 2,
        files: [badCssFile, plainCssFile],
        id: "test:1:lint-css-mixed-config",
        stageId: "lint",
      },
      process.cwd(),
    );

    expect(result.status).toBe("failed");
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "color-named", file: badCssFile, source: "stylelint" }),
      ]),
    );
    expect(result.notes).toContain("Stylelint reported 1 diagnostic.");
    expect(result.notes).toContain(
      `No Stylelint configuration was detected for lint in: ${plainCssFile}.`,
    );
    expect(result.toolRuns[0]).toMatchObject({
      exitCode: 1,
      status: "failed",
      tool: "stylelint",
    });
  });
});
