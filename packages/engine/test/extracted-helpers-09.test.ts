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
  it("builds direct JavaScript test commands only when the execution mode opts in", () => {
    const directVitest = createJavaScriptTestCommand({
      coverageDirectory: "/tmp/coverage",
      executionMode: "direct",
      mode: "unit",
      reportPath: "/tmp/report.json",
      runner: "vitest",
    });
    const npmJest = createJavaScriptTestCommand({
      coverageDirectory: "/tmp/coverage",
      executionMode: "npm",
      mode: "unit",
      reportPath: "/tmp/report.json",
      runner: "jest",
    });

    expect(directVitest.command).toBe(process.execPath);
    expect(directVitest.args).toEqual([
      expect.stringContaining(`${path.sep}node_modules${path.sep}vitest${path.sep}vitest.mjs`),
      "--passWithNoTests",
      "--reporter=json",
      "--outputFile=/tmp/report.json",
      "--run",
      "--pool=threads",
      "--poolOptions.threads.maxThreads=1",
      "--poolOptions.threads.minThreads=1",
      "--no-file-parallelism",
    ]);
    expect(npmJest).toEqual({
      args: [
        "test",
        "--",
        "--passWithNoTests",
        "--runInBand",
        "--json",
        "--outputFile=/tmp/report.json",
      ],
      command: process.platform === "win32" ? "npm.cmd" : "npm",
    });
  });
});
