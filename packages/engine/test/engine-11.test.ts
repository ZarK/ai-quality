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
  it("runs lint, format, unit, coverage, and security against JavaScript and TypeScript fixtures", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "aiq-engine-jsonc-"));
    tempDirs.push(tempDir);
    const jsoncFile = path.join(tempDir, "config.jsonc");
    await writeFile(jsoncFile, '{"name" :"typescript-fixture" ,"enabled" :true}\n', "utf8");

    const result = await runEngine({
      context: "cli",
      manifest: {
        files: [fixtureFile, fixtureJavaScriptFile, jsoncFile],
        source: "mixed",
      },
      mode: "check",
      stages: ["format", "unit", "coverage", "security"],
      writeArtifacts: false,
    });

    expect(result.ok).toBe(false);
    expect(result.summary.notImplementedStageCount).toBe(0);
    expect(result.summary.status).toBe("failed");
    expect(result.stages).toHaveLength(4);
    expect(result.stages.find((stage) => stage.stageId === "format")).toMatchObject({
      stageId: "format",
      status: "failed",
    });
    expect(result.stages.find((stage) => stage.stageId === "unit")).toMatchObject({
      stageId: "unit",
      status: "passed",
    });
    const unitStage = result.stages.find((stage) => stage.stageId === "unit");
    expect(unitStage?.toolRuns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "passed", tool: "vitest" }),
        expect.objectContaining({ status: "passed", tool: "jest" }),
      ]),
    );

    const coverageStage = result.stages.find((stage) => stage.stageId === "coverage");
    expect(coverageStage).toMatchObject({
      stageId: "coverage",
      status: "passed",
    });
    expect(coverageStage?.toolRuns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "passed", tool: "vitest" }),
        expect.objectContaining({ status: "passed", tool: "jest" }),
      ]),
    );
    expect(result.stages.find((stage) => stage.stageId === "security")).toMatchObject({
      stageId: "security",
      status: "passed",
    });
  });
});
