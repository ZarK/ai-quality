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
  it("invalidates cached JavaScript and TypeScript metrics when lizard config changes", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "aiq-js-ts-lizard-config-refresh-"));
    tempDirs.push(tempDir);

    const sourceFile = path.join(tempDir, "index.ts");
    await writeFile(path.join(tempDir, "package.json"), '{"type":"module"}\n', "utf8");
    await writeFile(sourceFile, "export const value = 1;\n", "utf8");

    const firstComplexity = await runPlannedTask(
      {
        fileCount: 1,
        files: [sourceFile],
        id: "test:1:complexity-js-ts-lizard-config:first",
        stageId: "complexity",
      },
      process.cwd(),
    );

    await writeFile(path.join(tempDir, ".lizard"), "", "utf8");

    const secondComplexity = await runPlannedTask(
      {
        fileCount: 1,
        files: [sourceFile],
        id: "test:1:complexity-js-ts-lizard-config:second",
        stageId: "complexity",
      },
      process.cwd(),
    );

    expect(firstComplexity.status).toBe("passed");
    expect(firstComplexity.toolRuns[0]).toMatchObject({
      cacheHit: false,
      exitCode: 0,
      status: "passed",
      tool: "lizard",
    });
    expect(secondComplexity.status).toBe("passed");
    expect(secondComplexity.toolRuns[0]).toMatchObject({
      cacheHit: false,
      exitCode: 0,
      status: "passed",
      tool: "lizard",
    });
  });
});
