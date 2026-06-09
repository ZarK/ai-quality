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
  it("does not reuse Python coverage executions across standalone runner calls", async () => {
    const project = await createCustomPythonRunnerProject({
      prefix: "aiq-python-no-cross-run-reuse-",
      runnerScript: [
        'const fs = require("node:fs");',
        'const path = require("node:path");',
        "const args = process.argv.slice(2);",
        'const junitPath = args[args.indexOf("--junitxml") + 1];',
        'const coverageArgIndex = args.indexOf("--cov-report");',
        "const coverageArg = coverageArgIndex >= 0 ? args[coverageArgIndex + 1] : undefined;",
        'const coveragePath = coverageArg && coverageArg.startsWith("json:") ? coverageArg.slice("json:".length) : undefined;',
        'const countFile = path.join(process.cwd(), "invocations.txt");',
        'const count = Number(fs.existsSync(countFile) ? fs.readFileSync(countFile, "utf8") : "0") + 1;',
        "fs.writeFileSync(countFile, String(count));",
        'fs.writeFileSync(junitPath, \'<testsuite tests="1" failures="0" errors="0" skipped="0"></testsuite>\');',
        "if (coveragePath) {",
        "  fs.mkdirSync(path.dirname(coveragePath), { recursive: true });",
        "  fs.writeFileSync(coveragePath, JSON.stringify({ totals: { percent_covered: 100 } }));",
        "}",
        "process.exit(0);",
        "",
      ].join("\n"),
    });

    const [coverageResult, unitResult] = await withPathedPythonShim(project.shimDir, async () => [
      await runPlannedTask(
        {
          fileCount: 1,
          files: [project.sourceFile],
          id: "test:1:coverage-python-no-cross-run-reuse",
          stageId: "coverage",
        },
        project.root,
      ),
      await runPlannedTask(
        {
          fileCount: 1,
          files: [project.sourceFile],
          id: "test:1:unit-python-no-cross-run-reuse",
          stageId: "unit",
        },
        project.root,
      ),
    ]);

    expect(coverageResult.status).toBe("passed");
    expect(coverageResult.toolRuns[0]).toMatchObject({ cacheHit: false, tool: "pytest-cov" });
    expect(unitResult.status).toBe("passed");
    expect(unitResult.toolRuns[0]).toMatchObject({ cacheHit: false, tool: "pytest" });
    expect(await readFile(path.join(project.root, "invocations.txt"), "utf8")).toBe("2");
  });
});
