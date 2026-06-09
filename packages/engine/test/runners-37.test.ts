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
  it("uses an ancestor e2e script to cover nested package projects", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "aiq-js-e2e-workspace-root-"));
    tempDirs.push(root);
    const packageRoot = path.join(root, "packages", "app");
    const sourceFile = path.join(packageRoot, "src", "index.ts");
    await mkdir(path.dirname(sourceFile), { recursive: true });
    await writeFile(
      path.join(root, "package.json"),
      `${JSON.stringify(
        {
          name: "workspace-root",
          private: true,
          scripts: {
            "aiq:e2e": "node e2e.cjs",
          },
          workspaces: ["packages/*"],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeFile(path.join(root, "e2e.cjs"), "process.exit(0);\n", "utf8");
    await writeFile(
      path.join(packageRoot, "package.json"),
      `${JSON.stringify({ name: "workspace-app", private: true }, null, 2)}\n`,
      "utf8",
    );
    await writeFile(sourceFile, "export const value = 1;\n", "utf8");

    const result = await runPlannedTask(
      {
        fileCount: 1,
        files: [sourceFile],
        id: "test:1:e2e-js-workspace-root",
        stageId: "e2e",
      },
      process.cwd(),
    );

    expect(result.status).toBe("passed");
    expect(result.diagnostics).toEqual([]);
    expect(result.toolRuns).toHaveLength(1);
    expect(result.toolRuns[0]).toMatchObject({
      args: ["run", "aiq:e2e", "--"],
      status: "passed",
      tool: "e2e",
    });
  });
});
