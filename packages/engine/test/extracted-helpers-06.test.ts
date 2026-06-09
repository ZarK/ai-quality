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
  it("builds Python test args with explicit coverage plugin loading", () => {
    expect(
      createPythonTestArgs({
        coveragePath: "/tmp/coverage.json",
        junitPath: "/tmp/junit.xml",
        mode: "unit",
      }),
    ).toEqual(["-m", "pytest", "--junitxml", "/tmp/junit.xml", "-q"]);
    expect(
      createPythonTestArgs({
        coveragePath: "/tmp/coverage.json",
        junitPath: "/tmp/junit.xml",
        mode: "coverage",
      }),
    ).toEqual([
      "-m",
      "pytest",
      "--junitxml",
      "/tmp/junit.xml",
      "-q",
      "-p",
      "pytest_cov",
      "--cov=.",
      "--cov-report",
      "json:/tmp/coverage.json",
    ]);
  });
});
