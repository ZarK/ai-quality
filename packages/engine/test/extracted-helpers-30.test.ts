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
  it("parses Windows-relative pytest traceback locations", async () => {
    const project = await createTempSourceFile("placeholder\n");

    const report = parsePytestReport(
      [
        '<testsuite tests="1" failures="1" errors="0" skipped="0">',
        '  <testcase classname="tests.test_example" name="test_example">',
        '    <failure message="AssertionError">File &quot;.\\tests\\test_example.py&quot;, line 17, in test_example',
        "AssertionError",
        "    </failure>",
        "  </testcase>",
        "</testsuite>",
      ].join("\n"),
      project.root,
    );

    expect(report.summary).toEqual({ failed: 1, passed: 0, total: 1 });
    expect(report.diagnostics).toEqual([
      expect.objectContaining({
        file: path.resolve(project.root, "tests/test_example.py"),
        range: { startColumn: 1, startLine: 17 },
        severity: "error",
        source: "pytest",
      }),
    ]);
  });
});
