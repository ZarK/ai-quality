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
  it.skipIf(!hasRustToolchain)(
    "parses Rust compiler diagnostics from cargo test JSON output",
    async () => {
      await withExclusiveRust(async () => {
        const project = await createRustFixtureProject("aiq-rust-unit-compile-fail-runner-");

        await writeFile(
          project.testFile,
          [
            "use aiq_rust_fixture::greet;",
            "",
            "#[test]",
            "fn integration_compile_failure() {",
            '    let message: i32 = greet("Rust");',
            "    assert_eq!(message, 1);",
            "}",
            "",
          ].join("\n"),
          "utf8",
        );

        const result = await runPlannedTask(
          {
            fileCount: 1,
            files: [project.sourceFile],
            id: "test:1:unit-rust-compile-fail",
            stageId: "unit",
          },
          process.cwd(),
        );

        expect(result.status).toBe("failed");
        expect(result.diagnostics).toContainEqual(
          expect.objectContaining({
            file: project.testFile,
            severity: "error",
            source: "cargo-test",
          }),
        );
        expect(
          result.diagnostics.some((diagnostic) => diagnostic.message.includes("mismatched types")),
        ).toBe(true);
        expect(result.toolRuns[0]).toMatchObject({
          status: "failed",
          tool: "cargo-test",
        });
      });
    },
    20_000,
  );
});
