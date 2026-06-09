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
  it("builds native config args for tools that accept explicit config paths", () => {
    expect(
      createBiomeLintArgs({ configPath: "/repo/biome.json", files: ["src/index.ts"] }),
    ).toEqual(["lint", "--config-path=/repo/biome.json", "--reporter=json", "src/index.ts"]);
    expect(createPlaywrightTestArgs({ configPath: "/repo/playwright.config.ts" })).toEqual([
      "test",
      "--config",
      "/repo/playwright.config.ts",
      "--reporter=json",
    ]);
  });
});
