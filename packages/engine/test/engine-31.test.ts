import { describe, expect, it, vi } from "vitest";
import {
  os,
  path,
  AiqEngineCancelledError,
  ToolRunner,
  commandAvailable,
  cp,
  createAbortError,
  createBashFixtureProject,
  createDotNetFixtureProject,
  createGoFixtureProject,
  createJavaMavenFixtureProject,
  createJavaScriptFixtureProject,
  createKotlinGradleFixtureProject,
  createLargeJavaScriptModule,
  createPowerShellFixtureProject,
  createRunPlan,
  createRustFixtureProject,
  createTerraformHclFixtureProject,
  createToolRunOutcome,
  createTypeScriptFixtureProject,
  createTypeScriptWorkloadModule,
  execFileSync,
  fixtureBashRoot,
  fixtureCssFile,
  fixtureDotNetRoot,
  fixtureFile,
  fixtureGoRoot,
  fixtureHclRoot,
  fixtureHtmlFile,
  fixtureJavaMavenRoot,
  fixtureJavaScriptFile,
  fixtureJavaScriptRoot,
  fixtureKotlinGradleRoot,
  fixturePowerShellRoot,
  fixturePythonFile,
  fixtureRustRoot,
  fixtureSqlFile,
  fixtureTerraformRoot,
  fixtureTypeScriptRoot,
  fixtureYamlFile,
  hasDotNet10Toolchain,
  hasGoToolchain,
  hasGradleToolchain,
  hasMavenToolchain,
  hasPowerShellPesterToolchain,
  hasPythonPytestToolchain,
  hasPythonQualityToolchain,
  hasRustCoverageToolchain,
  lintFailureFixtureFile,
  mkdir,
  mkdtemp,
  normalizeFileManifest,
  readFile,
  resolvePowerShellModuleAvailable,
  resolvePythonCommand,
  resolveRunRequest,
  rm,
  runEngine,
  tempDirs,
  withExclusiveRust,
  withExclusiveToolLock,
  writeFile,
  writeReportArtifact,
} from "./engine-test-helpers.js";

describe("engine foundation", () => {
  it("propagates cancellation during extracted TypeScript typecheck", async () => {
    const { root, sourceFile } = await createTypeScriptFixtureProject("aiq-engine-ts-cancel-");
    const generatedDir = path.join(root, "src", "generated");
    await mkdir(generatedDir, { recursive: true });

    await Promise.all(
      Array.from({ length: 400 }, (_, index) =>
        writeFile(
          path.join(generatedDir, `generated-${index}.ts`),
          createTypeScriptWorkloadModule(index),
          "utf8",
        ),
      ),
    );

    const controller = new AbortController();
    const runNodeToolSpy = vi
      .spyOn(ToolRunner.prototype, "runNodeTool")
      .mockImplementationOnce(async () => {
        controller.abort();
        throw createAbortError();
      });

    await expect(
      runEngine({
        context: "cli",
        cwd: root,
        manifest: {
          files: [sourceFile],
          source: "direct",
        },
        mode: "check",
        stages: ["typecheck"],
        signal: controller.signal,
        writeArtifacts: false,
      }),
    ).rejects.toBeInstanceOf(AiqEngineCancelledError);

    expect(runNodeToolSpy).toHaveBeenCalledOnce();
  }, 120_000);
});
