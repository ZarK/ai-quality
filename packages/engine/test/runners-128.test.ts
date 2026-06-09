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
  it("runs the shared security scan across the supported source and config file types", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "aiq-security-runner-"));
    tempDirs.push(tempDir);
    const githubToken = `ghp_${"123456789012345678901234567890123456"}`;

    const flaggedFiles = [
      {
        content: `export const token = "${githubToken}";\n`,
        name: "secret.ts",
      },
      {
        content: `{"token":"${githubToken}"}\n`,
        name: "secret.json",
      },
      {
        content: `token = "${githubToken}"\n`,
        name: "secret.py",
      },
      {
        content: `token="${githubToken}"\n`,
        name: "secret.sh",
      },
      {
        content: `@test "leaks a token" {\n  token="${githubToken}"\n}\n`,
        name: "secret.bats",
      },
      {
        content: `$Token = "${githubToken}"\n`,
        name: "secret.ps1",
      },
      {
        content: `<meta name="token" content="${githubToken}">\n`,
        name: "secret.html",
      },
      {
        content: `body { --token: "${githubToken}"; }\n`,
        name: "secret.css",
      },
      {
        content: `token: "${githubToken}"\n`,
        name: "secret.yaml",
      },
      {
        content: `token: "${githubToken}"\n`,
        name: "secret.yml",
      },
      {
        content: `insert into secrets(token) values ('${githubToken}');\n`,
        name: "secret.sql",
      },
      {
        content: `variable "token" {\n  default = "${githubToken}"\n}\n`,
        name: "secret.tf",
      },
      {
        content: `token = "${githubToken}"\n`,
        name: "secret.tfvars",
      },
      {
        content: `token = "${githubToken}"\n`,
        name: "secret.hcl",
      },
    ] as const;
    const flaggedPaths = await Promise.all(
      flaggedFiles.map(async ({ content, name }) => {
        const filePath = path.join(tempDir, name);
        await writeFile(filePath, content, "utf8");
        return filePath;
      }),
    );

    const result = await runPlannedTask(
      {
        fileCount: flaggedPaths.length,
        files: flaggedPaths,
        id: "test:1:security",
        stageId: "security",
      },
      process.cwd(),
    );

    expect(result.status).toBe("failed");
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        ...flaggedPaths.map((filePath) =>
          expect.objectContaining({ file: filePath, severity: "error", source: "aiq-security" }),
        ),
      ]),
    );
    expect(result.diagnostics).toHaveLength(flaggedPaths.length);
    expect(result.toolRuns[0]).toMatchObject({
      exitCode: 1,
      status: "failed",
      tool: "aiq-security",
    });
  });
});
