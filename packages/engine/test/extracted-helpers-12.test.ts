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
  it("clones registry entries so entry object mutations do not affect the registry", () => {
    const entries = [{ id: "lint", label: "Lint" }];
    const registry = createRegistry(entries);
    const [lintEntry] = entries;

    if (lintEntry === undefined) {
      throw new Error("Expected a registry entry to mutate.");
    }

    lintEntry.label = "Changed";

    expect(registry.entries).toEqual([{ id: "lint", label: "Lint" }]);
    expect(registry.byId.get("lint")).toEqual({ id: "lint", label: "Lint" });
  });
});
