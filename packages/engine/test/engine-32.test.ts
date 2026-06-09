import { describe, expect, it, vi } from "vitest";
import {
  os,
  path,
  AiqEngineCancelledError,
  ToolRunner,
  commandAvailable,
  cp,
  createAbortError,
  createBashFixtureProject,
  createDotNetFixtureProject,
  createGoFixtureProject,
  createJavaMavenFixtureProject,
  createJavaScriptFixtureProject,
  createKotlinGradleFixtureProject,
  createLargeJavaScriptModule,
  createPowerShellFixtureProject,
  createRunPlan,
  createRustFixtureProject,
  createTerraformHclFixtureProject,
  createToolRunOutcome,
  createTypeScriptFixtureProject,
  createTypeScriptWorkloadModule,
  execFileSync,
  fixtureBashRoot,
  fixtureCssFile,
  fixtureDotNetRoot,
  fixtureFile,
  fixtureGoRoot,
  fixtureHclRoot,
  fixtureHtmlFile,
  fixtureJavaMavenRoot,
  fixtureJavaScriptFile,
  fixtureJavaScriptRoot,
  fixtureKotlinGradleRoot,
  fixturePowerShellRoot,
  fixturePythonFile,
  fixtureRustRoot,
  fixtureSqlFile,
  fixtureTerraformRoot,
  fixtureTypeScriptRoot,
  fixtureYamlFile,
  hasDotNet10Toolchain,
  hasGoToolchain,
  hasGradleToolchain,
  hasMavenToolchain,
  hasPowerShellPesterToolchain,
  hasPythonPytestToolchain,
  hasPythonQualityToolchain,
  hasRustCoverageToolchain,
  lintFailureFixtureFile,
  mkdir,
  mkdtemp,
  normalizeFileManifest,
  readFile,
  resolvePowerShellModuleAvailable,
  resolvePythonCommand,
  resolveRunRequest,
  rm,
  runEngine,
  tempDirs,
  withExclusiveRust,
  withExclusiveToolLock,
  writeFile,
  writeReportArtifact,
} from "./engine-test-helpers.js";

describe("engine foundation", () => {
  it("propagates cancellation during extracted JavaScript unit runs", async () => {
    const { root, sourceFile, testFile } = await createJavaScriptFixtureProject(
      "aiq-engine-js-unit-cancel-",
    );
    await writeFile(
      testFile,
      [
        'const { greet } = require("./index.js");',
        "",
        'describe("greet", () => {',
        '  test("waits for cancellation", async () => {',
        "    await new Promise((resolve) => setTimeout(resolve, 10_000));",
        '    expect(greet("Alice")).toBe("Hello, Alice!");',
        "  });",
        "});",
        "",
      ].join("\n"),
      "utf8",
    );

    const controller = new AbortController();
    const runSpy = vi.spyOn(ToolRunner.prototype, "run").mockImplementationOnce(async () => {
      controller.abort();
      throw createAbortError();
    });

    await expect(
      runEngine({
        context: "cli",
        cwd: root,
        manifest: {
          files: [sourceFile],
          source: "direct",
        },
        mode: "check",
        stages: ["unit"],
        signal: controller.signal,
        writeArtifacts: false,
      }),
    ).rejects.toBeInstanceOf(AiqEngineCancelledError);

    expect(runSpy).toHaveBeenCalledOnce();
  }, 120_000);
});
