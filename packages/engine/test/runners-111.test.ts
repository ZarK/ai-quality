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
  it("detects Vitest projects through common config file variants", async () => {
    const variants = [
      {
        configFileName: "vitest.config.cjs",
        configSource: "module.exports = {};\n",
        tempPrefix: "aiq-vitest-config-cjs-",
      },
      {
        configFileName: "vitest.config.cts",
        configSource: "export default {};\n",
        tempPrefix: "aiq-vitest-config-cts-",
      },
    ];

    for (const variant of variants) {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), variant.tempPrefix));
      tempDirs.push(tempDir);

      await mkdir(path.join(tempDir, "src"), { recursive: true });
      await writeFile(
        path.join(tempDir, "package.json"),
        `${JSON.stringify({ name: variant.tempPrefix, private: true, scripts: { test: "node runner.cjs" } }, null, 2)}\n`,
        "utf8",
      );
      await writeFile(path.join(tempDir, variant.configFileName), variant.configSource, "utf8");
      await writeFile(
        path.join(tempDir, "runner.cjs"),
        [
          'const { spawnSync } = require("node:child_process");',
          `const result = spawnSync(process.execPath, [${JSON.stringify(vitestCliPath)}, ...process.argv.slice(2)], { stdio: "inherit" });`,
          "process.exit(result.status ?? 1);",
          "",
        ].join("\n"),
        "utf8",
      );

      const sourceFile = path.join(tempDir, "src", "index.ts");
      await writeFile(sourceFile, "export const value = 1;\n", "utf8");
      await writeFile(
        path.join(tempDir, "src", "index.test.ts"),
        [
          'import { describe, expect, it } from "vitest";',
          'import { value } from "./index";',
          "",
          'describe("config detection", () => {',
          '  it("passes", () => {',
          "    expect(value).toBe(1);",
          "  });",
          "});",
          "",
        ].join("\n"),
        "utf8",
      );

      const result = await runPlannedTask(
        {
          fileCount: 1,
          files: [sourceFile],
          id: `test:1:unit-${variant.configFileName}`,
          stageId: "unit",
        },
        process.cwd(),
      );

      expect(result.status).toBe("passed");
      expect(result.diagnostics).toEqual([]);
      expect(result.notes[0]).toContain("Vitest ran");
      expect(result.toolRuns[0]).toMatchObject({
        exitCode: 0,
        status: "passed",
        tool: "vitest",
      });
    }
  });
});
