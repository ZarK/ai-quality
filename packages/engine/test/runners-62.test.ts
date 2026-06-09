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
  it.skipIf(!hasGoToolchain)(
    "runs Go lint and returns structured diagnostics",
    async () => {
      const project = await createGoFixtureProject("aiq-go-lint-runner-");

      await writeFile(
        project.sourceFile,
        [
          "package fixture",
          "",
          'import "fmt"',
          "",
          "func Greet(name string) string {",
          '    fmt.Printf("%d", name)',
          '    return "Hello, " + name + "!"',
          "}",
          "",
          "func Sum(values []int) int {",
          "    total := 0",
          "    for _, value := range values {",
          "        total += value",
          "    }",
          "",
          "    return total",
          "}",
          "",
        ].join("\n"),
        "utf8",
      );

      const result = await runPlannedTask(
        {
          fileCount: 1,
          files: [project.sourceFile],
          id: "test:1:lint-go",
          stageId: "lint",
        },
        process.cwd(),
      );

      expect(result.status).toBe("failed");
      expect(result.diagnostics[0]).toMatchObject({
        code: "printf",
        file: project.sourceFile,
        severity: "error",
        source: "go-vet",
      });
      expect(result.diagnostics[0]?.message).toContain("fmt.Printf format %d has arg name");
      expect(result.toolRuns[0]).toMatchObject({
        status: "failed",
        tool: "go-vet",
      });
    },
    20_000,
  );
});
