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
  it("writes report artifacts to the requested outDir even if the result carries another path", async () => {
    const outDir = await mkdtemp(path.join(os.tmpdir(), "aiq-engine-"));
    const overrideDir = await mkdtemp(path.join(os.tmpdir(), "aiq-engine-override-"));
    tempDirs.push(outDir, overrideDir);

    const result = await runEngine({
      context: "cli",
      manifest: {
        files: [lintFailureFixtureFile],
        source: "direct",
      },
      mode: "check",
      outDir,
      stages: ["lint"],
      writeArtifacts: false,
    });

    const overridePath = path.join(overrideDir, "override.report.json");
    const writtenPath = await writeReportArtifact(
      {
        ...result,
        artifacts: {
          ...result.artifacts,
          reportPath: overridePath,
        },
      },
      outDir,
    );

    expect(writtenPath).toBe(path.join(outDir, "aiq.report.json"));
    const reportJson = JSON.parse(await readFile(writtenPath, "utf8")) as {
      artifacts: { reportPath: string };
    };
    expect(reportJson.artifacts.reportPath).toBe(writtenPath);
    await expect(readFile(overridePath, "utf8")).rejects.toThrow();
  });
});
