import { describe, expect, it } from "vitest";
import { MemoryInput, MemoryOutput, fixtureFile, runCli } from "./cli-test-helpers.js";

describe("CLI foundation", () => {
  it("runs explicit check output with the check label", async () => {
    const stdout = new MemoryOutput();
    const stderr = new MemoryOutput();

    const exitCode = await runCli(["node", "aiq", "check", fixtureFile, "--stage", "typecheck"], {
      cwd: process.cwd(),
      stderr,
      stdin: new MemoryInput(),
      stdout,
    });

    expect(exitCode).toBe(0);
    expect(stderr.value).toBe("");
    expect(stdout.value).toContain("AIQ check");
    expect(stdout.value).toContain("Status: passed");
    expect(stdout.value).toContain("Stages: 3 typecheck passed");
    expect(stdout.value).toContain("Next: no action required.");
    expect(stdout.value).not.toContain("Artifacts:");
  });

  it("supports run --up-to stage shortcuts using the published stage ladder", async () => {
    const stdout = new MemoryOutput();
    const stderr = new MemoryOutput();

    const exitCode = await runCli(
      ["node", "aiq", "run", fixtureFile, "--up-to", "0", "--format", "json"],
      {
        cwd: process.cwd(),
        stderr,
        stdin: new MemoryInput(),
        stdout,
      },
    );

    expect(exitCode).toBe(1);
    expect(stderr.value).toBe("");

    const output = JSON.parse(stdout.value) as {
      request: { selection: { stages: string[] } };
      stages: Array<{
        diagnostics: Array<{ source: string }>;
        stageId: string;
        status: string;
      }>;
    };
    expect(output.request.selection.stages).toEqual(["e2e"]);
    expect(output.stages).toMatchObject([{ stageId: "e2e", status: "failed" }]);
    expect(output.stages[0]?.diagnostics[0]?.source).toBe("aiq-e2e");
  });

  it("runs cumulative stages for run --up-to stage shortcuts", async () => {
    const stdout = new MemoryOutput();
    const stderr = new MemoryOutput();

    const exitCode = await runCli(
      ["node", "aiq", "run", fixtureFile, "--up-to", "3", "--dry-run", "--format", "json"],
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
      plan: { stages: string[] };
    };
    expect(output.plan.stages).toEqual(["e2e", "lint", "format", "typecheck"]);
  });

  it("supports run --only stage shortcuts using the published stage ladder", async () => {
    const stdout = new MemoryOutput();
    const stderr = new MemoryOutput();

    const exitCode = await runCli(
      ["node", "aiq", "run", fixtureFile, "--only", "3", "--format", "json"],
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
      request: { selection: { stages: string[] } };
      stages: Array<{ stageId: string }>;
    };
    expect(output.request.selection.stages).toEqual(["typecheck"]);
    expect(output.stages.map((stage) => stage.stageId)).toEqual(["typecheck"]);
  });

  it("rejects out-of-range stage shortcut flags with usage code", async () => {
    for (const argv of [
      ["node", "aiq", "run", fixtureFile, "--only", "10"],
      ["node", "aiq", "run", fixtureFile, "--up-to", "10"],
    ]) {
      const stdout = new MemoryOutput();
      const stderr = new MemoryOutput();

      const exitCode = await runCli(argv, {
        cwd: process.cwd(),
        stderr,
        stdin: new MemoryInput(),
        stdout,
      });

      expect(exitCode).toBe(2);
      expect(stdout.value).toBe("");
      expect(stderr.value).toContain("must be between 0 and 9");
    }
  });
});
