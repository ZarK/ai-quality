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
  it("uses lizard-style complexity defaults for file-level metric fallbacks", () => {
    const file = path.resolve("fixture.cs");
    const metrics = {
      [file]: {
        maintainability: { score: 100 },
        maxComplexity: { score: 11 },
        raw: { sloc: 10 },
      },
    };

    expect(createFileMetricDiagnostics(metrics, "maintainability", "aiq-csharp-metrics")).toEqual([
      expect.objectContaining({
        code: metricsDiagnosticCodes.lizardMaintainabilityComplexity,
        file,
        message: "Maintainability complexity 11 is greater than 10.",
      }),
    ]);
  });
});
