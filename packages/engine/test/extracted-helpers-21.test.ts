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
  it("parses multi-object go vet json-lines output", async () => {
    const project = await createTempSourceFile("package fixture\n");
    const goFile = path.join(project.root, "fixture.go");
    await writeFile(goFile, "package fixture\n", "utf8");

    const diagnostics = parseGoVetDiagnostics(
      "",
      [
        JSON.stringify({
          "example.com/fixture": {
            printf: [
              {
                message: "first issue",
                posn: "fixture.go:3:4",
              },
            ],
          },
        }),
        JSON.stringify({
          "example.com/fixture": {
            shift: [
              {
                message: "second issue",
                posn: "fixture.go:7:2",
              },
            ],
          },
        }),
      ].join("\n"),
      project.root,
    );

    expect(diagnostics).toEqual([
      {
        code: "printf",
        file: goFile,
        message: "first issue",
        range: {
          startColumn: 4,
          startLine: 3,
        },
        severity: "error",
        source: "go-vet",
      },
      {
        code: "shift",
        file: goFile,
        message: "second issue",
        range: {
          startColumn: 2,
          startLine: 7,
        },
        severity: "error",
        source: "go-vet",
      },
    ]);
  });
});
