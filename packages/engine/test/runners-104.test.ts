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
  it.skipIf(!hasDotNet10Toolchain)(
    "keeps fallback dotnet resolution passing when solution traversal cannot read an ancestor",
    async () => {
      const project = await createDotNetFixtureProject("aiq-dotnet-resolution-read-fallback-");
      const blockedDirectory = project.root;

      vi.resetModules();
      vi.doMock("node:fs/promises", async () => {
        const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
        type ReadDirectory = typeof actual.readdir;
        const actualReadDirectory = actual.readdir as ReadDirectory;

        return {
          ...actual,
          readdir: (async (...args: Parameters<ReadDirectory>) => {
            const [directoryPath] = args;
            if (
              typeof directoryPath === "string" &&
              path.resolve(directoryPath) === blockedDirectory
            ) {
              const error = new Error("simulated missing directory") as NodeJS.ErrnoException;
              error.code = "ENOENT";
              throw error;
            }

            return actualReadDirectory(...args);
          }) as ReadDirectory,
        };
      });

      try {
        const { runPlannedTask: runPlannedTaskWithMock } = await import("../src/runners.js");
        const result = await runPlannedTaskWithMock(
          {
            fileCount: 1,
            files: [project.sourceFile],
            id: "test:1:complexity-dotnet-resolution-read-fallback",
            stageId: "complexity",
          },
          process.cwd(),
        );

        expect(result.status).toBe("passed");
        expect(result.diagnostics).toEqual([]);
        expect(result.toolRuns[0]).toMatchObject({
          cacheHit: false,
          exitCode: 0,
          status: "passed",
          tool: "aiq-csharp-metrics",
        });
      } finally {
        vi.doUnmock("node:fs/promises");
        vi.resetModules();
      }
    },
    20_000,
  );
});
