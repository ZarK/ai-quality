import { describe, expect, it, vi } from "vitest";
import {
  os,
  path,
  capitalize,
  createBiomeLintArgs,
  createDirectJavaScriptTestArgs,
  createFileMetricDiagnostics,
  createJavaScriptTestArgs,
  createJavaScriptTestCommand,
  createLizardMetricsDiagnostics,
  createPlaywrightTestArgs,
  createPythonMetricsDiagnostics,
  createPythonTestArgs,
  createRegistry,
  createTempPackageProject,
  createTempSourceFile,
  createTerraformInitArgs,
  createTyCheckArgs,
  metricsDiagnosticCodes,
  mkdtemp,
  parseDotNetTrxReport,
  parseGoVetDiagnostics,
  parseLizardMetrics,
  parsePytestReport,
  parseTyGitlabDiagnostics,
  parseXmlAttributes,
  readMetricsThresholds,
  resolveDiagnosticFile,
  resolveJavaScriptTestExecutionMode,
  rm,
  tempDirs,
  writeFile,
} from "./extracted-helpers-test-helpers.js";

describe("extracted helper regressions", () => {
  it("fails lizard-backed SLOC, complexity, and maintainability defaults", async () => {
    const project = await createTempSourceFile(
      `${Array.from({ length: 350 }, () => "line").join("\n")}\n`,
    );
    const metrics = await parseLizardMetrics(
      "350,13,0,7,0,0,fixture.ts,work,1,23,24",
      project.root,
      [project.file],
    );

    expect(createLizardMetricsDiagnostics(metrics, "sloc", "lizard")).toEqual([
      expect.objectContaining({
        code: metricsDiagnosticCodes.sloc,
        file: project.file,
        message: "SLOC 350 is greater than or equal to 350.",
        source: "lizard",
      }),
    ]);
    expect(createLizardMetricsDiagnostics(metrics, "complexity", "lizard")).toEqual([
      expect.objectContaining({
        code: metricsDiagnosticCodes.lizardComplexity,
        file: project.file,
        message: "work complexity 13 is greater than 12.",
        source: "lizard",
      }),
    ]);
    expect(createLizardMetricsDiagnostics(metrics, "maintainability", "lizard")).toEqual([
      expect.objectContaining({
        code: metricsDiagnosticCodes.lizardMaintainabilityComplexity,
        file: project.file,
        message: "work maintainability complexity 13 is greater than 10.",
      }),
      expect.objectContaining({
        code: metricsDiagnosticCodes.lizardMaintainabilityFunctionNloc,
        file: project.file,
        message: "work function NLOC 350 is greater than 200.",
      }),
      expect.objectContaining({
        code: metricsDiagnosticCodes.lizardMaintainabilityParameterCount,
        file: project.file,
        message: "work parameter count 7 is greater than 6.",
      }),
    ]);
  });
});
