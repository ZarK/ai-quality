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
  it.skipIf(!hasPowerShellPesterToolchain)(
    "runs PowerShell stages against the fixture project and writes canonical artifacts",
    async () => {
      const project = await createPowerShellFixtureProject("aiq-engine-powershell-");
      const hasPester = await resolvePowerShellModuleAvailable("Pester");
      const hasAnalyzer = await resolvePowerShellModuleAvailable("PSScriptAnalyzer");

      const result = await runEngine({
        context: "cli",
        manifest: {
          files: [project.sourceFile],
          source: "direct",
        },
        mode: "check",
        outDir: project.root,
        stages: ["lint", "format", "unit", "coverage", "security"],
      });

      expect(result.artifacts.metricsPath).toBeDefined();
      expect(result.artifacts.planPath).toBeDefined();
      expect(result.artifacts.reportPath).toBeDefined();
      expect(result.stages).toHaveLength(5);
      expect(
        result.stages.find((stage) => stage.stageId === "security")?.toolRuns[0],
      ).toMatchObject({
        exitCode: 0,
        status: "passed",
        tool: "aiq-security",
      });

      const lintStage = result.stages.find((stage) => stage.stageId === "lint");
      const formatStage = result.stages.find((stage) => stage.stageId === "format");
      const unitStage = result.stages.find((stage) => stage.stageId === "unit");
      const coverageStage = result.stages.find((stage) => stage.stageId === "coverage");

      if (hasAnalyzer) {
        expect(lintStage?.status).toBe("passed");
        expect(lintStage?.toolRuns[0]).toMatchObject({
          status: "passed",
          tool: "psscriptanalyzer",
        });
        expect(formatStage?.status).toBe("passed");
        expect(formatStage?.toolRuns[0]).toMatchObject({
          status: "passed",
          tool: "invoke-formatter",
        });
      } else {
        expect(lintStage?.status).toBe("failed");
        expect(formatStage?.status).toBe("failed");
      }

      if (hasPester) {
        expect(unitStage?.status).toBe("passed");
        expect(unitStage?.toolRuns[0]).toMatchObject({ status: "passed", tool: "pester" });
        expect(unitStage?.notes[0]).toContain("Pester ran");

        expect(coverageStage?.status).toBe("passed");
        expect(coverageStage?.toolRuns[0]).toMatchObject({ status: "passed", tool: "pester" });
        expect(coverageStage?.notes[0]).toContain("PowerShell coverage lines:");
      } else {
        expect(unitStage?.status).toBe("not_implemented");
        expect(coverageStage?.status).toBe("not_implemented");
      }
    },
    60_000,
  );
});
