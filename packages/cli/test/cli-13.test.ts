import { describe, expect, it } from "vitest";
import {
  os,
  path,
  MemoryInput,
  MemoryOutput,
  createTypeScriptFixtureProject,
  mkdtemp,
  runCli,
  tempDirs,
  writeFile,
} from "./cli-test-helpers.js";

describe("CLI foundation", () => {
  it("accepts explicit doctor stage targeting flags", async () => {
    const project = await createTypeScriptFixtureProject("aiq-cli-doctor-stage-targets-");

    const cases: Array<{ args: string[]; exitCode: number; stages: string[] }> = [
      { args: ["--up-to", "3"], exitCode: 1, stages: ["e2e", "lint", "format", "typecheck"] },
      { args: ["--only", "1"], exitCode: 0, stages: ["lint"] },
      { args: ["--stage", "typecheck"], exitCode: 0, stages: ["typecheck"] },
      { args: ["--profile", "standard"], exitCode: 1, stages: ["lint", "typecheck", "unit"] },
    ];

    for (const testCase of cases) {
      const stdout = new MemoryOutput();
      const stderr = new MemoryOutput();
      const exitCode = await runCli(
        ["node", "aiq", "doctor", ...testCase.args, "--format", "json"],
        {
          cwd: project.root,
          stderr,
          stdin: new MemoryInput(),
          stdout,
        },
      );

      expect(exitCode).toBe(testCase.exitCode);
      expect(stderr.value).toBe("");
      const output = JSON.parse(stdout.value) as { stages: string[] };
      expect(output.stages).toEqual(testCase.stages);
    }
  });

  it("fails doctor when detected selected tech is missing required host tools", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "aiq-cli-doctor-python-missing-"));
    tempDirs.push(tempDir);
    await writeFile(path.join(tempDir, "main.py"), "print('hello')\n", "utf8");
    const stdout = new MemoryOutput();
    const stderr = new MemoryOutput();
    const originalPath = process.env.PATH;
    process.env.PATH = "";

    try {
      const exitCode = await runCli(
        ["node", "aiq", "doctor", "--stage", "typecheck", "--format", "json"],
        {
          cwd: tempDir,
          stderr,
          stdin: new MemoryInput(),
          stdout,
        },
      );

      expect(exitCode).toBe(1);
      expect(stderr.value).toBe("");
      const output = JSON.parse(stdout.value) as {
        checks: Array<{ detail?: string; name: string; ok: boolean; required?: boolean }>;
        detectedTech: string[];
        ok: boolean;
      };
      expect(output.ok).toBe(false);
      expect(output.detectedTech).toEqual(["Python"]);
      expect(output.checks.find((check) => check.name === "Python runtime")).toMatchObject({
        detail: expect.stringContaining("Install Python 3"),
        ok: false,
        required: true,
      });
    } finally {
      process.env.PATH = originalPath;
    }
  });
});
