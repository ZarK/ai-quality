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
  it("expands package.json selections to the actual JavaScript and TypeScript source count", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "aiq-js-metrics-package-json-"));
    tempDirs.push(tempDir);
    const projectRoot = path.join(tempDir, "project");
    await cp(path.dirname(fixtureTypeScriptPackageJson), projectRoot, { recursive: true });
    await writeFile(path.join(projectRoot, "src", "extra.ts"), "export const extra = 1;\n", "utf8");
    const expectedScannedFileCount = (await collectJavaScriptAndTypeScriptFiles(projectRoot))
      .length;

    const result = await runPlannedTask(
      {
        fileCount: 1,
        files: [path.join(projectRoot, "package.json")],
        id: "test:1:sloc-js-ts-package-json-source-count",
        stageId: "sloc",
      },
      process.cwd(),
    );

    expect(result.status).toBe("passed");
    expect(result.diagnostics).toEqual([]);
    expect(expectedScannedFileCount).toBe(5);
    expect(result.notes[0]).toContain(`across ${expectedScannedFileCount} files.`);
    expect(
      result.toolRuns.filter(
        (toolRun) =>
          toolRun.cacheHit === false &&
          toolRun.exitCode === 0 &&
          toolRun.status === "passed" &&
          toolRun.tool === "lizard",
      ),
    ).toHaveLength(1);
  });
});
