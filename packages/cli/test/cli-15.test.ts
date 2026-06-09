import { describe, expect, it } from "vitest";
import {
  os,
  path,
  MemoryInput,
  MemoryOutput,
  createTypeScriptFixtureProject,
  mkdir,
  mkdtemp,
  readFile,
  runCli,
  tempDirs,
  writeFile,
} from "./cli-test-helpers.js";

describe("CLI foundation", () => {
  it("ignores reference-only directories when detecting doctor setup requirements", async () => {
    const project = await createTypeScriptFixtureProject("aiq-cli-doctor-reference-files-");
    await mkdir(path.join(project.root, "docs"), { recursive: true });
    await writeFile(
      path.join(project.root, "docs", "example.py"),
      "print('reference only')\n",
      "utf8",
    );
    const stdout = new MemoryOutput();
    const stderr = new MemoryOutput();
    const originalPath = process.env.PATH;
    process.env.PATH = "";

    try {
      const exitCode = await runCli(
        ["node", "aiq", "doctor", "--stage", "typecheck", "--format", "json"],
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
        checks: Array<{ name: string; required?: boolean }>;
        detectedTech: string[];
        ok: boolean;
      };
      expect(output.ok).toBe(true);
      expect(output.detectedTech).toEqual(["TypeScript"]);
      expect(output.checks.find((check) => check.name === "Python runtime")).toBeUndefined();

      const setupStdout = new MemoryOutput();
      const setupStderr = new MemoryOutput();
      const setupExitCode = await runCli(
        ["node", "aiq", "setup", "--stage", "typecheck", "--format", "json"],
        {
          cwd: project.root,
          stderr: setupStderr,
          stdin: new MemoryInput(),
          stdout: setupStdout,
        },
      );

      expect(setupExitCode).toBe(0);
      expect(setupStderr.value).toBe("");
      const setupOutput = JSON.parse(setupStdout.value) as {
        actions: Array<{ name: string }>;
        detectedTech: string[];
        ok: boolean;
      };
      expect(setupOutput.ok).toBe(true);
      expect(setupOutput.detectedTech).toEqual(["TypeScript"]);
      expect(
        setupOutput.actions.find((action) => action.name === "Python runtime"),
      ).toBeUndefined();
    } finally {
      process.env.PATH = originalPath;
    }
  });

  it("returns explicit setup guidance for operational commands", async () => {
    const commands: Array<[string[], string]> = [
      [["node", "aiq", "hook", "install"], "Hook setup uses the dedicated AIQ hook adapter"],
      [["node", "aiq", "ci", "setup"], "CI setup uses explicit workflow configuration"],
      [["node", "aiq", "ignore", "write"], "Ignored inputs are configured"],
    ];
    for (const [commandArgs, expected] of commands) {
      const argv = [...commandArgs];
      const stdout = new MemoryOutput();
      const stderr = new MemoryOutput();

      const exitCode = await runCli(argv, {
        cwd: process.cwd(),
        stderr,
        stdin: new MemoryInput(),
        stdout,
      });

      expect(exitCode).toBe(0);
      expect(stderr.value).toBe("");
      expect(stdout.value).toContain(expected);
      expect(stdout.value).toContain("AIQ");
    }
  });

  it("initializes canonical config and progress files with aiq config", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "aiq-cli-config-init-"));
    tempDirs.push(tempDir);
    const stdout = new MemoryOutput();
    const stderr = new MemoryOutput();

    const exitCode = await runCli(["node", "aiq", "config"], {
      cwd: tempDir,
      stderr,
      stdin: new MemoryInput(),
      stdout,
    });

    expect(exitCode).toBe(0);
    expect(stderr.value).toBe("");
    expect(stdout.value).toContain("AIQ config initialized");
    expect(stdout.value).toContain(path.join(tempDir, ".aiq", "aiq.config.json"));
    expect(stdout.value).toContain(path.join(tempDir, ".aiq", "progress.json"));

    const config = JSON.parse(
      await readFile(path.join(tempDir, ".aiq", "aiq.config.json"), "utf8"),
    ) as { version: number };
    const progress = JSON.parse(
      await readFile(path.join(tempDir, ".aiq", "progress.json"), "utf8"),
    ) as { current_stage: number; disabled: number[]; last_run: string | null; order: number[] };
    expect(config).toEqual({ version: 1 });
    expect(progress).toEqual({
      current_stage: 1,
      disabled: [],
      order: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      last_run: null,
    });
  });
});
