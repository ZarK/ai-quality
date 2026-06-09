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
  it("does not pass a Biome config when selected files do not share one", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "aiq-biome-partial-native-config-"));
    tempDirs.push(tempDir);

    const configuredDir = path.join(tempDir, "configured");
    await mkdir(configuredDir, { recursive: true });
    const configuredFile = path.join(configuredDir, "index.ts");
    const defaultFile = path.join(tempDir, "index.ts");
    await writeFile(
      path.join(configuredDir, "biome.json"),
      `${JSON.stringify({ linter: { rules: { style: { noVar: "off" } } } }, null, 2)}\n`,
      "utf8",
    );
    await writeFile(configuredFile, "export const configured = 1;\n", "utf8");
    await writeFile(defaultFile, "export const fallback = 1;\n", "utf8");

    const result = await runPlannedTask(
      {
        fileCount: 2,
        files: [configuredFile, defaultFile],
        id: "test:1:lint-biome-partial-native-config",
        stageId: "lint",
      },
      process.cwd(),
    );

    expect(result.status).toBe("passed");
    expect(result.diagnostics).toEqual([]);
    expect(result.toolRuns[0]?.args.some((arg) => arg.startsWith("--config-path="))).toBe(false);
  });
});
