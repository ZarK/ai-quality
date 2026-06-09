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
  it("builds direct JavaScript test args without the npm wrapper", () => {
    expect(
      createDirectJavaScriptTestArgs({
        coverageDirectory: "/tmp/coverage",
        mode: "coverage",
        reportPath: "/tmp/report.json",
        runner: "vitest",
      }),
    ).toEqual([
      "--passWithNoTests",
      "--reporter=json",
      "--outputFile=/tmp/report.json",
      "--run",
      "--pool=threads",
      "--poolOptions.threads.maxThreads=1",
      "--poolOptions.threads.minThreads=1",
      "--no-file-parallelism",
      "--coverage",
      "--coverage.provider=v8",
      "--coverage.reportsDirectory=/tmp/coverage",
      "--coverage.reporter=json-summary",
    ]);
    expect(
      createJavaScriptTestArgs({
        coverageDirectory: "/tmp/coverage",
        mode: "coverage",
        reportPath: "/tmp/report.json",
        runner: "vitest",
      }),
    ).toEqual([
      "test",
      "--",
      "--passWithNoTests",
      "--reporter=json",
      "--outputFile=/tmp/report.json",
      "--run",
      "--pool=threads",
      "--poolOptions.threads.maxThreads=1",
      "--poolOptions.threads.minThreads=1",
      "--no-file-parallelism",
      "--coverage",
      "--coverage.provider=v8",
      "--coverage.reportsDirectory=/tmp/coverage",
      "--coverage.reporter=json-summary",
    ]);
  });
});
