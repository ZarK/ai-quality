import { describe, expect, it } from "vitest";
import {
  os,
  path,
  MemoryInput,
  MemoryOutput,
  access,
  fixtureFile,
  mkdtemp,
  runCli,
  tempDirs,
} from "./cli-test-helpers.js";

describe("CLI foundation", () => {
  it("prints a dry-run plan without executing tools or writing artifacts", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "aiq-cli-dry-run-"));
    tempDirs.push(tempDir);
    const stdout = new MemoryOutput();
    const stderr = new MemoryOutput();

    const exitCode = await runCli(
      [
        "node",
        "aiq",
        "run",
        fixtureFile,
        "--stage",
        "lint",
        "--dry-run",
        "--out-dir",
        tempDir,
        "--format",
        "json",
      ],
      {
        cwd: process.cwd(),
        stderr,
        stdin: new MemoryInput(),
        stdout,
      },
    );

    expect(exitCode).toBe(0);
    expect(stderr.value).toBe("");
    const output = JSON.parse(stdout.value) as {
      dryRun: boolean;
      plan: { stages: string[]; tasks: Array<{ stageId: string }> };
    };
    expect(output.dryRun).toBe(true);
    expect(output.plan.stages).toEqual(["lint"]);
    expect(output.plan.tasks).toMatchObject([{ stageId: "lint" }]);
    await expect(access(path.join(tempDir, "aiq.plan.json"))).rejects.toThrow();
    await expect(access(path.join(tempDir, "aiq.report.json"))).rejects.toThrow();
  });

  it("adds verbose command details to text run output", async () => {
    const stdout = new MemoryOutput();
    const stderr = new MemoryOutput();

    const exitCode = await runCli(
      ["node", "aiq", "run", fixtureFile, "--stage", "typecheck", "--verbose"],
      {
        cwd: process.cwd(),
        stderr,
        stdin: new MemoryInput(),
        stdout,
      },
    );

    expect(exitCode).toBe(0);
    expect(stderr.value).toBe("");
    expect(stdout.value).toContain("AIQ run");
    expect(stdout.value).toContain("Run:");
    expect(stdout.value).toContain("Artifacts:");
    expect(stdout.value).toContain("Verbose tool details:");
    expect(stdout.value).toContain("- typecheck: tsc");
    expect(stdout.value).toContain("status=passed");
  });

  it("records diff-only intent and keeps safe stages scoped to the changed manifest", async () => {
    const stdout = new MemoryOutput();
    const stderr = new MemoryOutput();

    const exitCode = await runCli(
      [
        "node",
        "aiq",
        "run",
        fixtureFile,
        "--stage",
        "lint",
        "--stage",
        "sloc",
        "--diff-only",
        "--dry-run",
        "--format",
        "json",
      ],
      {
        cwd: process.cwd(),
        stderr,
        stdin: new MemoryInput(),
        stdout,
      },
    );

    expect(exitCode).toBe(0);
    expect(stderr.value).toBe("");
    const output = JSON.parse(stdout.value) as {
      plan: {
        input: { files: string[] };
        request?: unknown;
        tasks: Array<{ files: string[]; stageId: string }>;
      };
    };
    expect(output.plan.input.files).toContain(fixtureFile);
    expect(output.plan.tasks).toEqual([
      expect.objectContaining({ files: [fixtureFile], stageId: "lint" }),
      expect.objectContaining({ files: [fixtureFile], stageId: "sloc" }),
    ]);
  });
});
