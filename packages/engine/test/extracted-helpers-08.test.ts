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
  it("uses direct JavaScript test execution only for exact plain runner scripts", async () => {
    const directVitestProject = await createTempPackageProject("  vitest  ");
    const wrappedVitestProject = await createTempPackageProject("vitest --run");
    const customScriptProject = await createTempPackageProject("node runner.cjs");

    await expect(
      resolveJavaScriptTestExecutionMode(directVitestProject.root, "vitest"),
    ).resolves.toBe("direct");
    await expect(
      resolveJavaScriptTestExecutionMode(wrappedVitestProject.root, "vitest"),
    ).resolves.toBe("npm");
    await expect(
      resolveJavaScriptTestExecutionMode(customScriptProject.root, "jest"),
    ).resolves.toBe("npm");
  });
});
