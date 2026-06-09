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
  it("parses Windows dotnet TRX stack traces", async () => {
    const project = await createTempSourceFile("placeholder\n");
    const windowsFile = path.win32.normalize("C:/repo/tests/Sample Tests.cs");

    const report = parseDotNetTrxReport(
      [
        "<TestRun>",
        '  <ResultSummary><Counters total="1" passed="0" failed="1" /></ResultSummary>',
        "  <Results>",
        '    <UnitTestResult testId="test-id" testName="Fails" outcome="Failed">',
        "      <Output><ErrorInfo>",
        "        <Message>Expected true but was false.</Message>",
        `        <StackTrace>at Tests.SampleTests.Fails() in ${windowsFile}:line 27</StackTrace>`,
        "      </ErrorInfo></Output>",
        "    </UnitTestResult>",
        "  </Results>",
        "  <TestDefinitions>",
        '    <UnitTest id="test-id">',
        '      <TestMethod codeBase="file:///C:/repo/bin/Debug/net10.0/SampleTests.dll" />',
        "    </UnitTest>",
        "  </TestDefinitions>",
        "</TestRun>",
      ].join("\n"),
      project.root,
    );

    expect(report.summary).toEqual({ failed: 1, passed: 0, total: 1 });
    expect(report.diagnostics).toEqual([
      expect.objectContaining({
        file: windowsFile,
        range: { startColumn: 1, startLine: 27 },
        severity: "error",
        source: "dotnet-test",
      }),
    ]);
  });
});
