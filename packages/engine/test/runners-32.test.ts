import { describe, expect, it, vi } from "vitest";
import {
  os,
  path,
  ToolRunner,
  binaries,
  buildEngineContext,
  chmod,
  collectJavaScriptAndTypeScriptFiles,
  commandAvailable,
  cp,
  createBashFixtureProject,
  createCustomJavaScriptE2eProject,
  createCustomJavaScriptRunnerProject,
  createCustomPythonRunnerProject,
  createDotNetCompetingSolutionProject,
  createDotNetFixtureProject,
  createGoFixtureProject,
  createJavaMavenFixtureProject,
  createKotlinGradleFixtureProject,
  createPowerShellFixtureProject,
  createRustFixtureProject,
  execFileSync,
  fixtureBashRoot,
  fixtureDotNetRoot,
  fixtureFile,
  fixtureGoRoot,
  fixtureJavaMavenRoot,
  fixtureJavaScriptFile,
  fixtureKotlinGradleRoot,
  fixturePowerShellRoot,
  fixturePythonConfigFile,
  fixturePythonFile,
  fixtureRustRoot,
  fixtureTsconfig,
  fixtureTypeScriptPackageJson,
  hasDotNet10Toolchain,
  hasGoToolchain,
  hasGradleToolchain,
  hasMavenToolchain,
  hasPowerShellPesterToolchain,
  hasPythonQualityToolchain,
  hasRustCoverageToolchain,
  hasRustToolchain,
  lintFailureFixtureFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  resolveCommandPath,
  resolvePowerShellModuleAvailable,
  rm,
  runEngine,
  runPlannedTask,
  tempDirs,
  vitestCliPath,
  withExclusiveDotNet,
  withExclusiveRust,
  withExclusiveToolLock,
  withPathedPythonShim,
  withToolRunnerOverride,
  writeFile,
} from "./runners-test-helpers.js";

describe("engine runners", () => {
  it("fails JavaScript unit when testResults contains non-object entries", async () => {
    const project = await createCustomJavaScriptRunnerProject({
      prefix: "aiq-js-invalid-test-results-array-",
      runner: "jest",
      runnerScript: [
        'const fs = require("node:fs");',
        'const outputFile = process.argv.find((arg) => arg.startsWith("--outputFile="));',
        'if (!outputFile) throw new Error("missing --outputFile");',
        'fs.writeFileSync(outputFile.slice("--outputFile=".length), JSON.stringify({ numFailedTests: 0, numPassedTests: 1, numTotalTests: 1, testResults: [1] }));',
        "process.exit(0);",
        "",
      ].join("\n"),
    });

    const result = await runPlannedTask(
      {
        fileCount: 1,
        files: [project.sourceFile],
        id: "test:1:unit-js-invalid-test-results-array",
        stageId: "unit",
      },
      process.cwd(),
    );

    expect(result.status).toBe("failed");
    expect(result.notes[0]).toContain("Expected test report at");
    expect(result.notes[0]).toContain("test summary fields");
    expect(result.diagnostics[0]).toMatchObject({
      file: project.sourceFile,
      severity: "error",
      source: "test-runner",
    });
    expect(result.toolRuns).toEqual([]);
  });
});
