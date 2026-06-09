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
  it("honors metrics threshold environment overrides", () => {
    expect(
      readMetricsThresholds({
        AIQ_SLOC_LIMIT: "500",
        LIZARD_CCN_LIMIT: "20",
        LIZARD_CCN_STRICT: "18",
        LIZARD_FN_NLOC_LIMIT: "400",
        LIZARD_PARAM_LIMIT: "9",
      }).slocLimit,
    ).toBe(500);
    expect(
      readMetricsThresholds({
        AIQ_SLOC_LIMIT: "500",
        LIZARD_CCN_LIMIT: "20",
        LIZARD_CCN_STRICT: "18",
        LIZARD_FN_NLOC_LIMIT: "400",
        LIZARD_PARAM_LIMIT: "9",
      }),
    ).toMatchObject({
      lizardComplexityLimit: 20,
      lizardMaintainabilityComplexityLimit: 18,
      lizardMaintainabilityFunctionNlocLimit: 400,
      lizardMaintainabilityParameterLimit: 9,
      slocLimit: 500,
    });
  });
});
