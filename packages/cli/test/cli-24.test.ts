import { describe, expect, it } from "vitest";
import {
  MemoryInput,
  MemoryOutput,
  createTypeScriptFixtureProject,
  parseJsonLines,
  runCli,
  waitFor,
} from "./cli-test-helpers.js";

describe("CLI foundation", () => {
  it("fails with usage code when a --files input does not exist", async () => {
    const stdout = new MemoryOutput();
    const stderr = new MemoryOutput();

    const exitCode = await runCli(
      ["node", "aiq", "check", "--files", "missing-cli-flag-input.ts"],
      {
        cwd: process.cwd(),
        stderr,
        stdin: new MemoryInput(),
        stdout,
      },
    );

    expect(exitCode).toBe(2);
    expect(stdout.value).toBe("");
    expect(stderr.value).toContain("Input file not found:");
    expect(stderr.value).toContain("missing-cli-flag-input.ts");
  });

  it("fails with usage code when the --files-from list does not exist", async () => {
    const stdout = new MemoryOutput();
    const stderr = new MemoryOutput();

    const exitCode = await runCli(["node", "aiq", "check", "--files-from", "missing-files.txt"], {
      cwd: process.cwd(),
      stderr,
      stdin: new MemoryInput(),
      stdout,
    });

    expect(exitCode).toBe(2);
    expect(stdout.value).toBe("");
    expect(stderr.value).toContain("File list not found:");
    expect(stderr.value).toContain("missing-files.txt");
  });

  it("fails with usage code when watch startup inputs do not resolve", async () => {
    const stdout = new MemoryOutput();
    const stderr = new MemoryOutput();

    await expect(
      runCli(["node", "aiq", "watch", "missing-watch-input.ts"], {
        cwd: process.cwd(),
        stderr,
        stdin: new MemoryInput(),
        stdout,
      }),
    ).resolves.toBe(2);

    expect(stdout.value).toBe("");
    expect(stderr.value).toContain("Input file not found:");
    expect(stderr.value).toContain("missing-watch-input.ts");
  });

  it("rejects malformed integer flags with usage code", async () => {
    for (const argv of [
      ["node", "aiq", "serve", "--port", "3000abc"],
      ["node", "aiq", "watch", "src/index.ts", "--debounce-ms", "40ms"],
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
      expect(stderr.value).toContain("must be a non-negative integer");
    }
  });

  it("accepts --port 0 for ephemeral serve ports", async () => {
    const project = await createTypeScriptFixtureProject("aiq-cli-serve-port-zero-");
    const stdout = new MemoryOutput();
    const stderr = new MemoryOutput();
    const controller = new AbortController();
    const runPromise = runCli(
      ["node", "aiq", "serve", "--host", "127.0.0.1", "--port", "0", "--format", "json"],
      {
        cwd: project.root,
        stderr,
        stdin: new MemoryInput(),
        stdout,
      },
      { signal: controller.signal },
    );

    const listening = await waitFor(() => {
      const lines = parseJsonLines<{ event: string; url: string }>(stdout.value);
      return lines.find((line) => line.event === "listening");
    });

    expect(listening.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/u);
    expect(stderr.value).toBe("");

    controller.abort();
    await expect(runPromise).resolves.toBe(0);
  });
});
