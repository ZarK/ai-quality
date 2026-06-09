import { describe, expect, it } from "vitest";
import {
  path,
  MemoryInput,
  MemoryOutput,
  createTypeScriptFixtureProject,
  mkdir,
  runCli,
  writeFile,
} from "./cli-test-helpers.js";

describe("CLI foundation", () => {
  it("lets explicit named run stages override persisted current_stage", async () => {
    const project = await createTypeScriptFixtureProject("aiq-cli-progress-named-stage-");
    await mkdir(path.join(project.root, ".aiq"), { recursive: true });
    await writeFile(
      path.join(project.root, ".aiq", "progress.json"),
      `${JSON.stringify({ current_stage: 3, disabled: [], order: [0, 1, 2, 3], last_run: null })}\n`,
      "utf8",
    );
    const stdout = new MemoryOutput();
    const stderr = new MemoryOutput();

    const exitCode = await runCli(
      [
        "node",
        "aiq",
        "run",
        "src/index.ts",
        "--stage",
        "security",
        "--dry-run",
        "--format",
        "json",
      ],
      {
        cwd: project.root,
        stderr,
        stdin: new MemoryInput(),
        stdout,
      },
    );

    expect(exitCode).toBe(0);
    expect(stderr.value).toBe("");
    const output = JSON.parse(stdout.value) as { plan: { stages: string[] } };
    expect(output.plan.stages).toEqual(["security"]);
  });

  it("does not require valid progress when explicit run stages are selected", async () => {
    const project = await createTypeScriptFixtureProject("aiq-cli-progress-invalid-explicit-");
    await mkdir(path.join(project.root, ".aiq"), { recursive: true });
    await writeFile(
      path.join(project.root, ".aiq", "progress.json"),
      `${JSON.stringify({ current_stage: 12, disabled: [], order: [0], last_run: null })}\n`,
      "utf8",
    );
    const stdout = new MemoryOutput();
    const stderr = new MemoryOutput();

    const exitCode = await runCli(
      ["node", "aiq", "run", "src/index.ts", "--only", "3", "--format", "json"],
      {
        cwd: project.root,
        stderr,
        stdin: new MemoryInput(),
        stdout,
      },
    );

    expect(exitCode).toBe(0);
    expect(stderr.value).toBe("");
    const output = JSON.parse(stdout.value) as {
      request: { selection: { stages: string[] } };
      workflow?: unknown;
    };
    expect(output.request.selection.stages).toEqual(["typecheck"]);
    expect(output.workflow).toBeUndefined();
  });

  it.each([12, -1])("fails fast on malformed progress stage %i", async (currentStage) => {
    const project = await createTypeScriptFixtureProject("aiq-cli-progress-invalid-");
    await mkdir(path.join(project.root, ".aiq"), { recursive: true });
    await writeFile(
      path.join(project.root, ".aiq", "progress.json"),
      `${JSON.stringify({ current_stage: currentStage, disabled: [], order: [0], last_run: null })}\n`,
      "utf8",
    );
    const stdout = new MemoryOutput();
    const stderr = new MemoryOutput();

    const exitCode = await runCli(["node", "aiq", "run", "src/index.ts"], {
      cwd: project.root,
      stderr,
      stdin: new MemoryInput(),
      stdout,
    });

    expect(exitCode).toBe(2);
    expect(stdout.value).toBe("");
    expect(stderr.value).toContain("current_stage must be a stage index from 0 to 9");
  });

  it("fails with usage code when a positional input file does not exist", async () => {
    const stdout = new MemoryOutput();
    const stderr = new MemoryOutput();

    const exitCode = await runCli(["node", "aiq", "check", "missing-cli-input.ts"], {
      cwd: process.cwd(),
      stderr,
      stdin: new MemoryInput(),
      stdout,
    });

    expect(exitCode).toBe(2);
    expect(stdout.value).toBe("");
    expect(stderr.value).toContain("Input file not found:");
    expect(stderr.value).toContain("missing-cli-input.ts");
  });

  it("does not classify bare dotted tokens as path inputs", async () => {
    const stdout = new MemoryOutput();
    const stderr = new MemoryOutput();

    const exitCode = await runCli(["node", "aiq", "example.com"], {
      cwd: process.cwd(),
      stderr,
      stdin: new MemoryInput(),
      stdout,
    });

    expect(exitCode).toBe(2);
    expect(stdout.value).toBe("");
    expect(stderr.value).toContain("Unknown command: example.com");
  });
});
