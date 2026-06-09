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
  it("runs Prettier document format checks for HTML, CSS, and YAML files", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "aiq-document-format-runner-"));
    tempDirs.push(tempDir);

    const badHtmlFile = path.join(tempDir, "bad.html");
    const badCssFile = path.join(tempDir, "bad.css");
    const badYamlFile = path.join(tempDir, "bad.yaml");
    await writeFile(badHtmlFile, "<!doctype html><html><body><p>Hi</p></body></html>\n", "utf8");
    await writeFile(badCssFile, "body{color:#333}\n", "utf8");
    await writeFile(badYamlFile, "service:\n    name: api\n    port: 8080\n", "utf8");

    const result = await runPlannedTask(
      {
        fileCount: 3,
        files: [badHtmlFile, badCssFile, badYamlFile],
        id: "test:1:format-documents",
        stageId: "format",
      },
      process.cwd(),
    );

    expect(result.status).toBe("failed");
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ file: badHtmlFile, severity: "error", source: "prettier" }),
        expect.objectContaining({ file: badCssFile, severity: "error", source: "prettier" }),
        expect.objectContaining({ file: badYamlFile, severity: "error", source: "prettier" }),
      ]),
    );
    expect(result.toolRuns[0]).toMatchObject({
      exitCode: 1,
      status: "failed",
      tool: "prettier",
    });
  });
});
