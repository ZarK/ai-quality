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
    "reports Rust coverage as not implemented when cargo llvm-cov is unavailable",
    async () => {
      await withExclusiveRust(async () => {
        const project = await createRustFixtureProject("aiq-rust-coverage-missing-tool-runner-");
        const shimRoot = await mkdtemp(path.join(os.tmpdir(), "aiq-rust-coverage-shim-"));
        tempDirs.push(shimRoot);

        const shimBin = path.join(shimRoot, "bin");
        await mkdir(shimBin, { recursive: true });

        const cargoShim = path.join(shimBin, "cargo");
        const cargoDir = path.dirname(resolveCommandPath("cargo"));
        const rustcDir = path.dirname(resolveCommandPath("rustc"));
        await writeFile(
          cargoShim,
          [
            "#!/bin/sh",
            'if [ "$1" = "llvm-cov" ]; then',
            "  printf '%s\\n' 'error: no such command: `llvm-cov`' >&2",
            "  exit 101",
            "fi",
            `exec "${path.join(cargoDir, "cargo")}" "$@"`,
            "",
          ].join("\n"),
          "utf8",
        );
        await chmod(cargoShim, 0o755);

        const toolRunner = new ToolRunner();
        const rustEnv = {
          PATH: [shimBin, cargoDir, rustcDir].join(path.delimiter),
        };

        vi.spyOn(toolRunner, "createRustProcessEnv").mockResolvedValue(rustEnv);
        vi.spyOn(toolRunner, "resolveInstalledBinary").mockImplementation(async (commandName) => {
          if (commandName === "cargo") {
            return cargoShim;
          }

          if (commandName === "rustc") {
            return path.join(rustcDir, "rustc");
          }

          return undefined;
        });

        const engineContext = withToolRunnerOverride(
          await buildEngineContext({
            context: "cli",
            manifest: {
              files: [project.sourceFile],
              source: "direct",
            },
            mode: "check",
            outDir: project.root,
            stages: ["coverage"],
          }),
          toolRunner,
        );

        const result = await runPlannedTask(
          {
            fileCount: 1,
            files: [project.sourceFile],
            id: "test:1:coverage-rust-missing-tool",
            stageId: "coverage",
          },
          engineContext,
        );

        expect(result.status).toBe("not_implemented");
        expect(result.diagnostics).toEqual([]);
        expect(result.notes[0]).toContain("cargo-llvm-cov");
        expect(result.toolRuns[0]).toMatchObject({
          exitCode: 101,
          status: "not_implemented",
          tool: "cargo-llvm-cov",
        });
      });
    },
    60_000,
  );
});
