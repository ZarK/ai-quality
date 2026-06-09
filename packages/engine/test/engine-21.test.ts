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
  it.skipIf(!hasPythonQualityToolchain)(
    "runs Python stages against the fixture project and writes canonical artifacts",
    async () => {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), "aiq-engine-python-"));
      tempDirs.push(tempDir);

      const result = await runEngine({
        context: "cli",
        manifest: {
          files: [fixturePythonFile],
          source: "direct",
        },
        mode: "check",
        outDir: tempDir,
        stages: [
          "lint",
          "format",
          "typecheck",
          "unit",
          "coverage",
          "complexity",
          "maintainability",
          "security",
        ],
      });

      expect(result.ok).toBe(true);
      expect(result.artifacts.metricsPath).toBeDefined();
      expect(result.artifacts.planPath).toBeDefined();
      expect(result.artifacts.reportPath).toBeDefined();
      expect(result.summary.diagnosticCount).toBe(0);
      expect(result.summary.notImplementedStageCount).toBe(0);
      expect(result.summary.status).toBe("passed");
      expect(result.stages).toHaveLength(8);
      expect(result.stages.find((stage) => stage.stageId === "lint")?.toolRuns[0]).toMatchObject({
        exitCode: 0,
        status: "passed",
        tool: "ruff",
      });
      expect(result.stages.find((stage) => stage.stageId === "format")?.toolRuns[0]).toMatchObject({
        exitCode: 0,
        status: "passed",
        tool: "ruff",
      });
      expect(
        result.stages.find((stage) => stage.stageId === "typecheck")?.toolRuns[0],
      ).toMatchObject({
        exitCode: 0,
        status: "passed",
        tool: "ty",
      });
      expect(result.stages.find((stage) => stage.stageId === "unit")?.notes[0]).toBe(
        "Pytest ran 3 tests: 3 passed, 0 failed.",
      );
      expect(result.stages.find((stage) => stage.stageId === "coverage")?.notes[0]).toMatch(
        /^Pytest coverage lines: \d+\.\d% across 3 tests\.$/u,
      );
      expect(
        result.stages.find((stage) => stage.stageId === "complexity")?.toolRuns[0],
      ).toMatchObject({
        cacheHit: false,
        exitCode: 0,
        status: "passed",
        tool: "radon",
      });
      expect(
        result.stages.find((stage) => stage.stageId === "maintainability")?.toolRuns[0],
      ).toMatchObject({
        cacheHit: true,
        exitCode: 0,
        status: "passed",
        tool: "radon",
      });
      expect(
        result.stages.find((stage) => stage.stageId === "maintainability")?.notes.join(" "),
      ).toContain("Reused cached Python metrics");
      expect(
        result.stages.find((stage) => stage.stageId === "security")?.toolRuns[0],
      ).toMatchObject({
        exitCode: 0,
        status: "passed",
        tool: "aiq-security",
      });

      const { metricsPath, planPath, reportPath } = requirePythonArtifactPaths(result.artifacts);

      const planJson = JSON.parse(await readFile(planPath, "utf8")) as {
        input: { files: string[] };
        stages: string[];
      };
      const reportJson = JSON.parse(await readFile(reportPath, "utf8")) as {
        stages: Array<{
          notes: string[];
          stageId: string;
          status: string;
          toolRuns: Array<{ cacheHit?: boolean; tool: string }>;
        }>;
        summary: { diagnosticCount: number; status: string };
      };
      const metricsEvents = (await readFile(metricsPath, "utf8"))
        .trim()
        .split("\n")
        .map(
          (line) =>
            JSON.parse(line) as {
              cacheHit?: boolean;
              event: string;
              stageId?: string;
              tool?: string;
            },
        );

      expect(planJson.input.files).toEqual([fixturePythonFile]);
      expect(planJson.stages).toEqual([
        "lint",
        "format",
        "typecheck",
        "unit",
        "coverage",
        "complexity",
        "maintainability",
        "security",
      ]);
      expect(reportJson.summary.diagnosticCount).toBe(0);
      expect(reportJson.summary.status).toBe("passed");
      expect(
        reportJson.stages.find((stage) => stage.stageId === "coverage")?.toolRuns[0],
      ).toMatchObject({
        tool: "pytest-cov",
      });
      expect(
        reportJson.stages.find((stage) => stage.stageId === "maintainability")?.notes.join(" "),
      ).toContain("Reused cached Python metrics");
      expect(metricsEvents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            cacheHit: true,
            event: "cache.hit",
            stageId: "maintainability",
            tool: "radon",
          }),
        ]),
      );
    },
  );
});

function requirePythonArtifactPaths(
  artifacts: Awaited<ReturnType<typeof runEngine>>["artifacts"],
): { metricsPath: string; planPath: string; reportPath: string } {
  const { metricsPath, planPath, reportPath } = artifacts;
  if (planPath === undefined || reportPath === undefined || metricsPath === undefined) {
    throw new Error("Expected plan, report, and metrics artifacts to be written.");
  }

  return { metricsPath, planPath, reportPath };
}
