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
  it("resets standalone runner reuse between identical back-to-back engine runs", async () => {
    const project = await createCustomJavaScriptRunnerProject({
      prefix: "aiq-js-engine-run-reset-",
      runner: "jest",
      runnerScript: [
        'const fs = require("node:fs");',
        'const path = require("node:path");',
        'const countFile = path.join(__dirname, "invocations.txt");',
        'const outputFileArg = process.argv.find((arg) => arg.startsWith("--outputFile="));',
        'if (!outputFileArg) throw new Error("missing --outputFile");',
        'const isCoverage = process.argv.some((arg) => arg === "--coverage");',
        'const count = Number(fs.existsSync(countFile) ? fs.readFileSync(countFile, "utf8") : "0") + 1;',
        "fs.writeFileSync(countFile, String(count));",
        'fs.writeFileSync(outputFileArg.slice("--outputFile=".length), JSON.stringify({ numFailedTests: 0, numPassedTests: 1, numTotalTests: 1, testResults: [] }));',
        "if (isCoverage) {",
        '  const coverageDirectoryArg = process.argv.find((arg) => arg.startsWith("--coverageDirectory="));',
        '  if (!coverageDirectoryArg) throw new Error("missing --coverageDirectory");',
        '  fs.mkdirSync(coverageDirectoryArg.slice("--coverageDirectory=".length), { recursive: true });',
        '  fs.writeFileSync(path.join(coverageDirectoryArg.slice("--coverageDirectory=".length), "coverage-summary.json"), JSON.stringify({ total: { lines: { total: 4, covered: 4, skipped: 0, pct: 100 } } }));',
        "}",
        "process.exit(0);",
        "",
      ].join("\n"),
    });

    const request = {
      context: "cli" as const,
      cwd: project.root,
      manifest: {
        files: [project.sourceFile],
        source: "direct" as const,
      },
      mode: "check" as const,
      outDir: project.root,
      stages: ["unit", "coverage"] as const,
    };

    const first = await runEngine(request);
    const second = await runEngine(request);

    expect(first.summary.status).toBe("passed");
    expect(second.summary.status).toBe("passed");
    expect(first.stages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stageId: "unit", status: "passed" }),
        expect.objectContaining({ stageId: "coverage", status: "passed" }),
      ]),
    );
    expect(second.stages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stageId: "unit", status: "passed" }),
        expect.objectContaining({ stageId: "coverage", status: "passed" }),
      ]),
    );
    expect(first.stages.find((stage) => stage.stageId === "unit")?.toolRuns[0]).toMatchObject({
      cacheHit: false,
      tool: "jest",
    });
    expect(second.stages.find((stage) => stage.stageId === "unit")?.toolRuns[0]).toMatchObject({
      cacheHit: false,
      tool: "jest",
    });
    expect(await readFile(path.join(project.root, "invocations.txt"), "utf8")).toBe("2");
  });
});
