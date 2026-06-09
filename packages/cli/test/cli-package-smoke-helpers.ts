import { expect } from "vitest";
import type { PackedPackageFixture } from "./cli-package-smoke-fixture.js";
import {
  path,
  access,
  builtCliPath,
  mkdir,
  readFile,
  repoRoot,
  runCommand,
  runNpmCommand,
} from "./cli-test-helpers.js";

async function verifyBuiltPackageEntrypoints(): Promise<void> {
  const builtHelp = await runCommand(process.execPath, [builtCliPath, "--help"], {
    cwd: repoRoot,
  });
  expect(builtHelp.exitCode).toBe(0);
  expect(builtHelp.stderr).toBe("");
  expect(builtHelp.stdout).toContain("Usage:");

  const builtBench = await runCommand(
    process.execPath,
    [builtCliPath, "bench", "--scenario", "javascript-lint-single-file-cold", "--format", "json"],
    { cwd: repoRoot },
  );
  expect(builtBench.exitCode).toBe(0);
  expect(builtBench.stderr).toBe("");
  expect(JSON.parse(builtBench.stdout)).toMatchObject({
    artifactType: "benchmark",
    summary: {
      scenarioCount: 1,
    },
  });
}

async function verifyPackedPackageFiles(packedFixture: PackedPackageFixture): Promise<void> {
  const cliPackage = packedFixture.packages.find((entry) => entry.workspace === "packages/cli");
  expect(cliPackage?.files.map((entry) => entry.path).sort()).toEqual(
    expect.arrayContaining([
      "README.md",
      "dist/api.js",
      "dist/benchmark/index.js",
      "dist/bin/aiq.js",
      "dist/config/index.js",
      "dist/engine/index.js",
      "dist/model/index.js",
      "dist/reporters/index.js",
    ]),
  );

  const installedPackageReadme = await readFile(
    path.join(packedFixture.root, "node_modules", "@tjalve", "aiq", "README.md"),
    "utf8",
  );
  expect(installedPackageReadme).toContain("# @tjalve/aiq");
  expect(installedPackageReadme).toContain("npx @tjalve/aiq");
  expect(installedPackageReadme).not.toContain("Repository Workflow");
}

async function verifyPackedHelpAndSchema(root: string): Promise<void> {
  const packedHelp = await runNpmCommand(["exec", "--", "aiq", "--", "--help"], { cwd: root });
  expect(packedHelp.exitCode).toBe(0);
  expect(packedHelp.stdout).toContain("Usage:");
  expect(packedHelp.stdout).toContain("aiq <files...>");
  expect(packedHelp.stdout).toContain("aiq run <files...>");
  expect(packedHelp.stdout).toContain("0=e2e 1=lint 2=format 3=typecheck");
  expect(packedHelp.stdout).toContain("--up-to <0-9>");
  expect(packedHelp.stdout).toContain("--only <0-9>");
  expect(packedHelp.stderr).not.toContain("ReferenceError");

  const packedSchema = await runNpmCommand(
    ["exec", "--", "aiq", "--", "schema", "--format", "json"],
    { cwd: root },
  );
  expect(packedSchema.exitCode).toBe(0);
  expect(packedSchema.stderr).not.toContain("ReferenceError");
  expect(JSON.parse(packedSchema.stdout)).toMatchObject({
    bin: "aiq",
    package: { name: "@tjalve/aiq" },
    schemaVersion: 1,
  });
}

async function verifyPackedFirstRun(packedFixture: PackedPackageFixture): Promise<void> {
  const packedFirstRun = await runNpmCommand(["exec", "--", "aiq"], {
    cwd: packedFixture.root,
  });
  expect(packedFirstRun.exitCode).toBe(0);
  expect(packedFirstRun.stderr).not.toContain("ReferenceError");
  expect(packedFirstRun.stdout).toContain("AIQ first run");
  expect(packedFirstRun.stdout).toContain("Detected project: JavaScript/Node (package.json)");
  expect(packedFirstRun.stdout).toContain("AIQ run");
  expect(packedFirstRun.stdout).toContain("Stages: 1 lint passed");
  await access(path.join(packedFixture.root, ".aiq", "aiq.config.json"));
  await access(path.join(packedFixture.root, ".aiq", "progress.json"));

  const emptyDir = path.join(packedFixture.root, "empty");
  await mkdir(emptyDir);
  const packedEmptyFirstRun = await runNpmCommand(["exec", "--", "aiq"], {
    cwd: emptyDir,
  });
  expect(packedEmptyFirstRun.exitCode).toBe(2);
  expect(packedEmptyFirstRun.stderr).toBe("");
  expect(packedEmptyFirstRun.stdout).toContain("AIQ first run");
  expect(packedEmptyFirstRun.stdout).toContain("No supported project marker was found");
  expect(packedEmptyFirstRun.stdout).toContain("Examples:");
}

async function verifyPackedRunSelection(root: string): Promise<void> {
  const packedSetStage = await runNpmCommand(
    ["exec", "--", "aiq", "--", "config", "--set-stage", "3"],
    { cwd: root },
  );
  expect(packedSetStage.exitCode).toBe(0);
  expect(packedSetStage.stderr).not.toContain("ReferenceError");
  expect(packedSetStage.stdout).toContain("Set current_stage=3");

  const packedDefaultRunPlan = await runNpmCommand(
    ["exec", "--", "aiq", "--", "run", "src/index.ts", "--dry-run", "--format", "json"],
    { cwd: root },
  );
  expect(packedDefaultRunPlan.exitCode).toBe(0);
  expect(packedDefaultRunPlan.stderr).not.toContain("ReferenceError");
  expect(JSON.parse(packedDefaultRunPlan.stdout).plan.stages).toEqual([
    "e2e",
    "lint",
    "format",
    "typecheck",
  ]);

  const packedUpToRunPlan = await runNpmCommand(
    [
      "exec",
      "--",
      "aiq",
      "--",
      "run",
      "src/index.ts",
      "--up-to",
      "3",
      "--dry-run",
      "--format",
      "json",
    ],
    { cwd: root },
  );
  expect(packedUpToRunPlan.exitCode).toBe(0);
  expect(packedUpToRunPlan.stderr).not.toContain("ReferenceError");
  expect(JSON.parse(packedUpToRunPlan.stdout).plan.stages).toEqual([
    "e2e",
    "lint",
    "format",
    "typecheck",
  ]);
}

async function verifyPackedRunCommands(root: string): Promise<void> {
  const packedOnlyRun = await runNpmCommand(
    ["exec", "--", "aiq", "--", "run", "src/index.ts", "--only", "1"],
    { cwd: root },
  );
  expect(packedOnlyRun.exitCode).toBe(0);
  expect(packedOnlyRun.stderr).not.toContain("ReferenceError");
  expect(packedOnlyRun.stdout).toContain("AIQ run");
  expect(packedOnlyRun.stdout).toContain("Stages: 1 lint passed");
  expect(packedOnlyRun.stdout).not.toContain("AIQ check");

  const packedImplicitRun = await runNpmCommand(
    ["exec", "--", "aiq", "--", "src/index.ts", "--only", "1"],
    { cwd: root },
  );
  expect(packedImplicitRun.exitCode).toBe(0);
  expect(packedImplicitRun.stderr).not.toContain("ReferenceError");
  expect(packedImplicitRun.stdout).toContain("AIQ run");
  expect(packedImplicitRun.stdout).toContain("Stages: 1 lint passed");
  expect(packedImplicitRun.stdout).not.toContain("AIQ check");

  const packedRunJson = await runNpmCommand(
    ["exec", "--", "aiq", "--", "run", "src/index.ts", "--only", "1", "--format", "json"],
    { cwd: root },
  );
  expect(packedRunJson.exitCode).toBe(0);
  expect(packedRunJson.stderr).not.toContain("ReferenceError");
  expect(JSON.parse(packedRunJson.stdout)).toMatchObject({
    context: "cli",
    request: { context: "cli", selection: { stages: ["lint"] } },
    summary: { fileCount: 1, status: "passed" },
  });
}

async function verifyPackedAuxiliaryCommands(root: string): Promise<void> {
  const packedDoctor = await runNpmCommand(["exec", "--", "aiq", "--", "doctor", "--only", "1"], {
    cwd: root,
  });
  expect(packedDoctor.exitCode).toBe(0);
  expect(packedDoctor.stderr).not.toContain("ReferenceError");
  expect(packedDoctor.stdout).toContain("AIQ doctor");
  expect(packedDoctor.stdout).toContain("Stages: lint");

  const packedRemovedCommand = await runNpmCommand(["exec", "--", "aiq", "--", "ci", "setup"], {
    cwd: root,
  });
  expect(packedRemovedCommand.exitCode).toBe(0);
  expect(packedRemovedCommand.stderr).not.toContain("ReferenceError");
  expect(packedRemovedCommand.stdout).toContain("CI setup uses explicit workflow configuration");

  const packedBench = await runNpmCommand(
    [
      "exec",
      "--",
      "aiq",
      "--",
      "bench",
      "--corpus-root",
      repoRoot,
      "--scenario",
      "javascript-lint-single-file-cold",
      "--format",
      "json",
    ],
    { cwd: root },
  );
  expect(packedBench.exitCode).toBe(0);
  expect(packedBench.stderr).not.toContain("ReferenceError");
  expect(JSON.parse(packedBench.stdout)).toMatchObject({
    artifactType: "benchmark",
    selection: {
      scenarioIds: ["javascript-lint-single-file-cold"],
    },
    summary: {
      scenarioCount: 1,
    },
  });
}

async function verifyPackedCliCommands(packedFixture: PackedPackageFixture): Promise<void> {
  await verifyPackedHelpAndSchema(packedFixture.root);
  await verifyPackedFirstRun(packedFixture);
  await verifyPackedRunSelection(packedFixture.root);
  await verifyPackedRunCommands(packedFixture.root);
  await verifyPackedAuxiliaryCommands(packedFixture.root);
}

async function verifyPackedTopLevelImport(root: string): Promise<void> {
  const packedTopLevelImport = await runCommand(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "const pkg = await import('@tjalve/aiq'); console.log(typeof pkg.runCli);",
    ],
    { cwd: root },
  );
  expect(packedTopLevelImport.exitCode).toBe(0);
  expect(packedTopLevelImport.stderr).toBe("");
  expect(packedTopLevelImport.stdout.trim()).toBe("function");
}

async function verifyPackedApiImport(root: string): Promise<void> {
  const packedApiImport = await runCommand(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      [
        "const api = await import('@tjalve/aiq/api');",
        "console.log(JSON.stringify({",
        "runEngine: typeof api.runEngine,",
        "createRunPlan: typeof api.createRunPlan,",
        "resolveAiqConfig: typeof api.resolveAiqConfig,",
        "stageIds: Array.isArray(api.stageIds),",
        "formatRunResultAsText: typeof api.formatRunResultAsText,",
        "runBenchmarkSuite: typeof api.runBenchmarkSuite",
        "}));",
      ].join(" "),
    ],
    { cwd: root },
  );
  expect(packedApiImport.exitCode).toBe(0);
  expect(packedApiImport.stderr).toBe("");
  expect(JSON.parse(packedApiImport.stdout) as Record<string, unknown>).toEqual({
    createRunPlan: "function",
    formatRunResultAsText: "function",
    resolveAiqConfig: "function",
    runBenchmarkSuite: "function",
    runEngine: "function",
    stageIds: true,
  });
}

async function verifyPackedSchemaImport(root: string): Promise<void> {
  const packedSchemaImport = await runCommand(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      [
        "const schema = await import('@tjalve/aiq/schema');",
        "const rendered = schema.renderAiqCommandSchema();",
        "console.log(JSON.stringify({",
        "render: typeof schema.renderAiqCommandSchema,",
        "json: typeof schema.renderAiqCommandSchemaJson,",
        "commands: rendered.commands.length",
        "}));",
      ].join(" "),
    ],
    { cwd: root },
  );
  expect(packedSchemaImport.exitCode).toBe(0);
  expect(packedSchemaImport.stderr).toBe("");
  expect(JSON.parse(packedSchemaImport.stdout) as Record<string, unknown>).toEqual({
    commands: 8,
    json: "function",
    render: "function",
  });
}

async function verifyPackedSubpathImports(root: string): Promise<void> {
  const packedSubpathImport = await runCommand(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      [
        "const benchmark = await import('@tjalve/aiq/benchmark');",
        "const config = await import('@tjalve/aiq/config');",
        "const engine = await import('@tjalve/aiq/engine');",
        "const model = await import('@tjalve/aiq/model');",
        "const reporters = await import('@tjalve/aiq/reporters');",
        "console.log(JSON.stringify({",
        "runBenchmarkSuite: typeof benchmark.runBenchmarkSuite,",
        "resolveAiqConfig: typeof config.resolveAiqConfig,",
        "runEngine: typeof engine.runEngine,",
        "stageIds: Array.isArray(model.stageIds),",
        "formatRunResultAsText: typeof reporters.formatRunResultAsText",
        "}));",
      ].join(" "),
    ],
    { cwd: root },
  );
  expect(packedSubpathImport.exitCode).toBe(0);
  expect(packedSubpathImport.stderr).toBe("");
  expect(JSON.parse(packedSubpathImport.stdout) as Record<string, unknown>).toEqual({
    formatRunResultAsText: "function",
    resolveAiqConfig: "function",
    runBenchmarkSuite: "function",
    runEngine: "function",
    stageIds: true,
  });
}

async function verifyPackedCliImports(packedFixture: PackedPackageFixture): Promise<void> {
  await verifyPackedTopLevelImport(packedFixture.root);
  await verifyPackedApiImport(packedFixture.root);
  await verifyPackedSchemaImport(packedFixture.root);
  await verifyPackedSubpathImports(packedFixture.root);
}

export {
  verifyBuiltPackageEntrypoints,
  verifyPackedCliCommands,
  verifyPackedCliImports,
  verifyPackedPackageFiles,
};
