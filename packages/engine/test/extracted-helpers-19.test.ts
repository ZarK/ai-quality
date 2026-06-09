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
  it("fails Python SLOC, complexity, maintainability, and readability defaults", () => {
    const file = path.resolve("fixture.py");
    const metrics = {
      [file]: {
        cc: [
          {
            complexity: 11,
            endline: 12,
            lineno: 4,
            name: "work",
            rank: "C",
            type: "Function",
          },
        ],
        mi: {
          rank: "C",
          score: 39,
        },
        raw: {
          blank: 0,
          comments: 0,
          lloc: 0,
          loc: 350,
          multi: 0,
          singleComments: 0,
          sloc: 350,
        },
        readability: {
          score: 84,
        },
      },
    };

    expect(createPythonMetricsDiagnostics(metrics, "sloc", "radon")).toEqual([
      expect.objectContaining({
        code: metricsDiagnosticCodes.sloc,
        file,
        message: "SLOC 350 is greater than or equal to 350.",
      }),
    ]);
    expect(createPythonMetricsDiagnostics(metrics, "complexity", "radon")).toEqual([
      expect.objectContaining({
        code: metricsDiagnosticCodes.pythonComplexity,
        file,
        message: "work complexity rank C is not allowed; only A/B complexity ranks pass.",
      }),
    ]);
    expect(createPythonMetricsDiagnostics(metrics, "maintainability", "radon")).toEqual([
      expect.objectContaining({
        code: metricsDiagnosticCodes.pythonMaintainability,
        file,
        message: "Maintainability index 39.0 is less than 40.",
      }),
      expect.objectContaining({
        code: metricsDiagnosticCodes.pythonReadability,
        file,
        message: "Readability index 84.0 is less than 85.",
      }),
    ]);
  });
});
