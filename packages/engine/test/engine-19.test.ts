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
  it("runs shared metrics stages against JavaScript and TypeScript fixtures", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "aiq-engine-js-metrics-"));
    tempDirs.push(tempDir);

    const result = await runEngine({
      context: "cli",
      manifest: {
        files: [fixtureFile, fixtureJavaScriptFile],
        source: "mixed",
      },
      mode: "check",
      outDir: tempDir,
      stages: ["sloc", "complexity", "maintainability"],
    });

    assertJavaScriptMetricsRun(result);
    assertJavaScriptMetricsArtifacts(await readJavaScriptMetricsArtifacts(result));
  });
});

function assertJavaScriptMetricsRun(result: Awaited<ReturnType<typeof runEngine>>): void {
  expect(result.ok).toBe(true);
  expect(result.summary.cacheHitCount).toBe(4);
  expect(result.summary.cacheMissCount).toBe(2);
  expect(result.summary.diagnosticCount).toBe(0);
  expect(result.summary.notImplementedStageCount).toBe(0);
  expect(result.summary.status).toBe("passed");
  expect(result.stages).toHaveLength(3);
  assertJavaScriptMetricsStages(result);
}

function assertJavaScriptMetricsStages(result: Awaited<ReturnType<typeof runEngine>>): void {
  const slocStage = result.stages.find((stage) => stage.stageId === "sloc");
  const complexityStage = result.stages.find((stage) => stage.stageId === "complexity");
  const maintainabilityStage = result.stages.find((stage) => stage.stageId === "maintainability");

  expect(slocStage?.notes[0]).toContain("JavaScript/TypeScript SLOC:");
  expect(readLizardRuns(slocStage, false)).toHaveLength(2);
  expect(complexityStage?.notes[0]).toContain("Shared metrics observed");
  expect(complexityStage?.notes.join(" ")).toContain("Reused cached JavaScript/TypeScript metrics");
  expect(readLizardRuns(complexityStage, true)).toHaveLength(2);
  expect(maintainabilityStage?.notes.join(" ")).toContain(
    "Reused cached JavaScript/TypeScript metrics",
  );
  expect(readLizardRuns(maintainabilityStage, true)).toHaveLength(2);
}

function readLizardRuns(
  stage: Awaited<ReturnType<typeof runEngine>>["stages"][number] | undefined,
  cacheHit: boolean,
) {
  return (
    stage?.toolRuns.filter(
      (toolRun) =>
        toolRun.cacheHit === cacheHit &&
        toolRun.exitCode === 0 &&
        toolRun.status === "passed" &&
        toolRun.tool === "lizard",
    ) ?? []
  );
}

async function readJavaScriptMetricsArtifacts(result: Awaited<ReturnType<typeof runEngine>>) {
  const { metricsPath, planPath, reportPath } = result.artifacts;
  if (planPath === undefined || reportPath === undefined || metricsPath === undefined) {
    throw new Error("Expected plan, report, and metrics artifacts to be written.");
  }

  return {
    metricsEvents: (await readFile(metricsPath, "utf8"))
      .trim()
      .split("\n")
      .map(JSON.parse) as Array<{
      cacheHit?: boolean;
      event: string;
      stageId?: string;
      tool?: string;
    }>,
    planJson: JSON.parse(await readFile(planPath, "utf8")) as {
      input: { files: string[] };
      stages: string[];
    },
    reportJson: JSON.parse(await readFile(reportPath, "utf8")) as {
      stages: Array<{
        notes: string[];
        stageId: string;
        toolRuns: Array<{ cacheHit?: boolean; tool: string }>;
      }>;
      summary: {
        cacheHitCount: number;
        cacheMissCount: number;
        diagnosticCount: number;
        status: string;
      };
    },
  };
}

function assertJavaScriptMetricsArtifacts(
  artifacts: Awaited<ReturnType<typeof readJavaScriptMetricsArtifacts>>,
): void {
  expect(artifacts.planJson.input.files).toEqual([fixtureJavaScriptFile, fixtureFile]);
  expect(artifacts.planJson.stages).toEqual(["sloc", "complexity", "maintainability"]);
  expect(artifacts.reportJson.summary.cacheHitCount).toBe(4);
  expect(artifacts.reportJson.summary.cacheMissCount).toBe(2);
  expect(artifacts.reportJson.summary.diagnosticCount).toBe(0);
  expect(artifacts.reportJson.summary.status).toBe("passed");
  expect(
    artifacts.reportJson.stages
      .find((stage) => stage.stageId === "maintainability")
      ?.notes.join(" "),
  ).toContain("Reused cached JavaScript/TypeScript metrics");
  expect(artifacts.metricsEvents).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        cacheHit: true,
        event: "cache.hit",
        stageId: "complexity",
        tool: "lizard",
      }),
      expect.objectContaining({
        cacheHit: true,
        event: "cache.hit",
        stageId: "maintainability",
        tool: "lizard",
      }),
    ]),
  );
}
