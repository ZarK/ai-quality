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
  it("parses pretty-printed concatenated go vet json output", async () => {
    const project = await createTempSourceFile("package fixture\n");
    const goFile = path.join(project.root, "fixture.go");
    await writeFile(goFile, "package fixture\n", "utf8");

    const diagnostics = parseGoVetDiagnostics(
      "",
      [
        JSON.stringify({}, null, 2),
        JSON.stringify(
          {
            "example.com/fixture": {
              printf: [
                {
                  message: "fmt.Printf format %d has arg name of wrong type string",
                  posn: "fixture.go:6:17",
                },
              ],
            },
          },
          null,
          2,
        ),
      ].join("\n"),
      project.root,
    );

    expect(diagnostics).toEqual([
      {
        code: "printf",
        file: goFile,
        message: "fmt.Printf format %d has arg name of wrong type string",
        range: {
          startColumn: 17,
          startLine: 6,
        },
        severity: "error",
        source: "go-vet",
      },
    ]);
  });
});
