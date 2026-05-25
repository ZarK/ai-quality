import { afterEach, describe, expect, it, vi } from "vitest";

import { type ToolRunOutcome, ToolRunner } from "../src/tool-runner.js";

function createOutcome(overrides: Partial<ToolRunOutcome> = {}): ToolRunOutcome {
  return {
    durationMs: 1,
    exitCode: 0,
    finishedAt: "2026-03-25T00:00:01.000Z",
    startedAt: "2026-03-25T00:00:00.000Z",
    stderr: "",
    stdout: "",
    ...overrides,
  };
}

describe("ToolRunner binary lookup", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps graceful not-found behavior for which/where fallback", async () => {
    const runner = new ToolRunner();

    vi.spyOn(runner, "resolveInstalledBinary").mockResolvedValue(undefined);
    const runSpy = vi.spyOn(runner, "run").mockResolvedValue(createOutcome({ exitCode: 1 }));

    await expect(runner.resolveBinaryIfAvailable(["missing-binary"])).resolves.toBeUndefined();
    expect(runSpy).toHaveBeenCalledWith(
      process.platform === "win32" ? "where" : "which",
      ["missing-binary"],
      { cwd: process.cwd() },
    );
  });

  it("normalizes missing executables into outcomes", async () => {
    const runner = new ToolRunner();

    const outcome = await runner.run(`aiq-missing-command-${process.pid}`, [], {
      cwd: process.cwd(),
    });

    expect(outcome.exitCode).toBeUndefined();
    expect(outcome.stderr).toBe("");
    expect(outcome.stdout).toBe("");
  });

  it("rethrows unexpected exec-file string-code failures", async () => {
    const runner = new ToolRunner();

    await expect(
      runner.run(process.execPath, ["-e", 'process.stdout.write("x".repeat(4096))'], {
        cwd: process.cwd(),
        maxBuffer: 1,
      }),
    ).rejects.toMatchObject({ code: "ERR_CHILD_PROCESS_STDIO_MAXBUFFER" });
  });

  it("propagates aborts from asdf binary lookup", async () => {
    const runner = new ToolRunner();
    const abortError = new Error("lookup aborted");
    abortError.name = "AbortError";

    vi.spyOn(runner, "run").mockRejectedValue(abortError);

    await expect(runner.resolveInstalledBinary("node")).rejects.toBe(abortError);
  });

  it("propagates unexpected asdf binary lookup failures", async () => {
    const runner = new ToolRunner();
    const lookupError = new Error("asdf lookup exploded");

    vi.spyOn(runner, "run").mockRejectedValue(lookupError);

    await expect(runner.resolveInstalledBinary("node")).rejects.toBe(lookupError);
  });

  it("propagates aborts from which/where fallback", async () => {
    const runner = new ToolRunner();
    const abortError = new Error("lookup aborted");
    abortError.name = "AbortError";

    vi.spyOn(runner, "resolveInstalledBinary").mockResolvedValue(undefined);
    vi.spyOn(runner, "run").mockRejectedValue(abortError);

    await expect(runner.resolveBinaryIfAvailable(["node"])).rejects.toBe(abortError);
  });

  it("propagates unexpected which/where lookup failures", async () => {
    const runner = new ToolRunner();
    const lookupError = new Error("which lookup exploded");

    vi.spyOn(runner, "resolveInstalledBinary").mockResolvedValue(undefined);
    vi.spyOn(runner, "run").mockRejectedValue(lookupError);

    await expect(runner.resolveBinaryIfAvailable(["node"])).rejects.toBe(lookupError);
  });
});
