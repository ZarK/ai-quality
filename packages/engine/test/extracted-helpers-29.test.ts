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
  it("falls back to the description prefix when ty omits check_name", () => {
    const projectRoot = path.join(os.tmpdir(), "aiq-ty-parser-project");
    const diagnostics = parseTyGitlabDiagnostics(
      JSON.stringify([
        {
          description:
            "invalid-assignment: Object of type `Literal[42]` is not assignable to `str`",
          location: {
            path: "bad.py",
            positions: {
              begin: { column: 14, line: 1 },
              end: { column: 16, line: 1 },
            },
          },
          severity: "major",
        },
      ]),
      projectRoot,
    );

    expect(diagnostics).toEqual([
      {
        code: "invalid-assignment",
        file: path.join(projectRoot, "bad.py"),
        message: "invalid-assignment: Object of type `Literal[42]` is not assignable to `str`",
        range: {
          endColumn: 16,
          endLine: 1,
          startColumn: 14,
          startLine: 1,
        },
        severity: "error",
        source: "ty",
      },
    ]);
  });
});
