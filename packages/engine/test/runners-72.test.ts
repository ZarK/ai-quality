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
    "runs Rust typecheck and parses compiler diagnostics",
    async () => {
      await withExclusiveRust(async () => {
        const project = await createRustFixtureProject("aiq-rust-typecheck-runner-");

        await writeFile(
          project.sourceFile,
          [
            "pub fn greet(name: &str) -> String {",
            "    let trimmed_name = name.trim();",
            "    42 + trimmed_name.len()",
            "}",
            "",
            "pub fn sum(values: &[i32]) -> i32 {",
            "    values.iter().sum()",
            "}",
            "",
          ].join("\n"),
          "utf8",
        );

        const result = await runPlannedTask(
          {
            fileCount: 1,
            files: [project.sourceFile],
            id: "test:1:typecheck-rust",
            stageId: "typecheck",
          },
          process.cwd(),
        );

        expect(result.status).toBe("failed");
        expect(result.diagnostics[0]).toMatchObject({
          file: project.sourceFile,
          severity: "error",
          source: "cargo-check",
        });
        expect(result.diagnostics[0]?.message).toContain("mismatched types");
        expect(result.toolRuns[0]).toMatchObject({
          status: "failed",
          tool: "cargo-check",
        });
      });
    },
    20_000,
  );
});
