import { describe, expect, it } from "vitest";
import {
  os,
  path,
  MemoryInput,
  MemoryOutput,
  chmod,
  fixtureFile,
  mkdir,
  mkdtemp,
  runCli,
  tempDirs,
  writeFile,
} from "./cli-test-helpers.js";

describe("CLI foundation", () => {
  it("warns when first-run skips an unreadable subdirectory", async () => {
    if (process.platform === "win32") {
      return;
    }

    const tempDir = await mkdtemp(path.join(os.tmpdir(), "aiq-cli-first-run-unreadable-"));
    tempDirs.push(tempDir);
    await writeFile(path.join(tempDir, "package.json"), '{"name":"unreadable"}\n', "utf8");
    const unreadableDir = path.join(tempDir, "src", "private");
    await mkdir(unreadableDir, { recursive: true });
    await writeFile(path.join(unreadableDir, "hidden.ts"), "export const hidden = true;\n", "utf8");
    await chmod(unreadableDir, 0);
    const stdout = new MemoryOutput();
    const stderr = new MemoryOutput();

    try {
      const exitCode = await runCli(["node", "aiq"], {
        cwd: tempDir,
        stderr,
        stdin: new MemoryInput(),
        stdout,
      });

      expect(exitCode).toBe(0);
      expect(stderr.value).toBe("");
      expect(stdout.value).toContain("Warning: Skipped unreadable directory");
    } finally {
      await chmod(unreadableDir, 0o700).catch(() => undefined);
    }
  });

  it("fails fast when the first token is an unknown command", async () => {
    const stdout = new MemoryOutput();
    const stderr = new MemoryOutput();

    const exitCode = await runCli(["node", "aiq", "chek", fixtureFile], {
      cwd: process.cwd(),
      stderr,
      stdin: new MemoryInput(),
      stdout,
    });

    expect(exitCode).toBe(2);
    expect(stdout.value).toBe("");
    expect(stderr.value).toContain("Unknown command: chek");
  });

  it("treats an existing extensionless first token as an implicit run path", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "aiq-cli-extensionless-path-"));
    tempDirs.push(tempDir);
    await writeFile(path.join(tempDir, "LICENSE"), "AIQ fixture\n", "utf8");

    const stdout = new MemoryOutput();
    const stderr = new MemoryOutput();

    const exitCode = await runCli(
      ["node", "aiq", "LICENSE", "--stage", "e2e", "--format", "json"],
      {
        cwd: tempDir,
        stderr,
        stdin: new MemoryInput(),
        stdout,
      },
    );

    expect(exitCode).toBe(0);
    expect(stderr.value).toBe("");

    const output = JSON.parse(stdout.value) as {
      request: { manifest: { files: string[] }; selection: { stages: string[] } };
    };
    expect(output.request.manifest.files).toEqual([path.join(tempDir, "LICENSE")]);
    expect(output.request.selection.stages).toEqual(["e2e"]);
  });

  it("treats a leading file path as an implicit run command", async () => {
    const stdout = new MemoryOutput();
    const stderr = new MemoryOutput();

    const exitCode = await runCli(["node", "aiq", fixtureFile, "--stage", "typecheck"], {
      cwd: process.cwd(),
      stderr,
      stdin: new MemoryInput(),
      stdout,
    });

    expect(exitCode).toBe(0);
    expect(stderr.value).toBe("");
    expect(stdout.value).toContain("AIQ run");
    expect(stdout.value).toContain("Status: passed");
    expect(stdout.value).toContain("Stages: 3 typecheck passed");
    expect(stdout.value).toContain("Next: no action required.");
    expect(stdout.value).not.toContain("Artifacts:");
  });

  it("runs explicit target output with the run label", async () => {
    const stdout = new MemoryOutput();
    const stderr = new MemoryOutput();

    const exitCode = await runCli(["node", "aiq", "run", fixtureFile, "--stage", "typecheck"], {
      cwd: process.cwd(),
      stderr,
      stdin: new MemoryInput(),
      stdout,
    });

    expect(exitCode).toBe(0);
    expect(stderr.value).toBe("");
    expect(stdout.value).toContain("AIQ run");
    expect(stdout.value).toContain("Status: passed");
    expect(stdout.value).toContain("Stages: 3 typecheck passed");
    expect(stdout.value).toContain("Next: no action required.");
    expect(stdout.value).not.toContain("Artifacts:");
  });
});
