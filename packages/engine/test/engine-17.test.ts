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
  it.skipIf(!hasGradleToolchain)(
    "preserves JVM settings files for configured Kotlin runners",
    async () => {
      const project = await createKotlinGradleFixtureProject(
        "aiq-engine-kotlin-settings-selection-",
      );

      const result = await runEngine({
        context: "cli",
        cwd: project.root,
        manifest: {
          files: [path.join(project.root, "settings.gradle.kts")],
          source: "direct",
        },
        mode: "check",
        stages: ["unit"],
        stageConfigurations: {
          unit: {
            languages: {
              kotlin: {
                toolId: "jvm",
              },
            },
          },
        },
        writeArtifacts: false,
      });

      const unitStage = result.stages.find((stage) => stage.stageId === "unit");

      expect(result.ok).toBe(true);
      expect(unitStage).toMatchObject({ stageId: "unit", status: "passed" });
      expect(unitStage?.toolRuns).toEqual([
        expect.objectContaining({ exitCode: 0, status: "passed", tool: "gradle-test" }),
      ]);
      expect(unitStage?.notes.join(" ")).toContain("Gradle test ran");
    },
    120_000,
  );
});
