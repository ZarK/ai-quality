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
  it("falls back to a plain Python unit run when coverage mode exits non-zero but tests themselves pass", async () => {
    const project = await createCustomPythonRunnerProject({
      prefix: "aiq-python-coverage-exit-fallback-",
      runnerScript: [
        'const fs = require("node:fs");',
        'const path = require("node:path");',
        "const args = process.argv.slice(2);",
        'const junitPath = args[args.indexOf("--junitxml") + 1];',
        'const countFile = path.join(process.cwd(), "invocations.txt");',
        'const count = Number(fs.existsSync(countFile) ? fs.readFileSync(countFile, "utf8") : "0") + 1;',
        'const coverageArgIndex = args.indexOf("--cov-report");',
        "const isCoverage = coverageArgIndex >= 0;",
        "fs.writeFileSync(countFile, String(count));",
        'fs.writeFileSync(junitPath, \'<testsuite tests="1" failures="0" errors="0" skipped="0"></testsuite>\');',
        "if (isCoverage) { process.exit(1); }",
        "process.exit(0);",
        "",
      ].join("\n"),
    });

    const result = await withPathedPythonShim(project.shimDir, async () =>
      runEngine({
        context: "cli",
        cwd: project.root,
        manifest: {
          files: [project.sourceFile],
          source: "direct",
        },
        mode: "check",
        outDir: path.join(project.root, ".aiq", "out"),
        stages: ["unit", "coverage"],
        writeArtifacts: false,
      }),
    );

    const unitStage = result.stages.find((stage) => stage.stageId === "unit");
    const coverageStage = result.stages.find((stage) => stage.stageId === "coverage");

    expect(result.summary.status).toBe("failed");
    expect(unitStage).toMatchObject({ stageId: "unit", status: "passed" });
    expect(unitStage?.toolRuns[0]).toMatchObject({
      cacheHit: false,
      exitCode: 0,
      status: "passed",
      tool: "pytest",
    });
    expect(coverageStage).toMatchObject({ stageId: "coverage", status: "failed" });
    expect(coverageStage?.toolRuns[0]).toMatchObject({
      cacheHit: false,
      exitCode: 1,
      status: "failed",
      tool: "pytest-cov",
    });
    expect(await readFile(path.join(project.root, "invocations.txt"), "utf8")).toBe("3");
  });
});
