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
  it("reports missing bundled TypeScript runner as setup guidance", async () => {
    const { root, sourceFile } = await createTypeScriptFixtureProject(
      "aiq-engine-ts-missing-runner-",
    );
    vi.spyOn(ToolRunner.prototype, "runNodeTool").mockResolvedValueOnce(
      createToolRunOutcome({ exitCode: undefined }),
    );

    const result = await runEngine({
      context: "cli",
      cwd: root,
      manifest: {
        files: [sourceFile],
        source: "direct",
      },
      mode: "check",
      stages: ["typecheck"],
      writeArtifacts: false,
    });

    const diagnostic = result.stages[0]?.diagnostics[0];

    expect(result.ok).toBe(false);
    expect(result.stages[0]).toMatchObject({
      stageId: "typecheck",
      status: "failed",
    });
    expect(diagnostic).toMatchObject({
      source: "tsc",
      message: expect.stringContaining("Run aiq setup"),
    });
    expect(diagnostic?.message).not.toContain("spawn");
  });
});
