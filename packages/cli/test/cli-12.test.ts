import { describe, expect, it } from "vitest";
import {
  os,
  path,
  MemoryInput,
  MemoryOutput,
  createTypeScriptFixtureProject,
  mkdir,
  mkdtemp,
  runCli,
  tempDirs,
  writeFile,
} from "./cli-test-helpers.js";

describe("CLI foundation", () => {
  it("reports optional universal doctor prerequisites without failing the command", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "aiq-cli-doctor-missing-"));
    tempDirs.push(tempDir);
    const stdout = new MemoryOutput();
    const stderr = new MemoryOutput();
    const originalPath = process.env.PATH;
    process.env.PATH = "";

    try {
      const exitCode = await runCli(["node", "aiq", "doctor", "--format", "json"], {
        cwd: tempDir,
        stderr,
        stdin: new MemoryInput(),
        stdout,
      });

      expect(exitCode).toBe(0);
      expect(stderr.value).toBe("");
      const output = JSON.parse(stdout.value) as {
        checks: Array<{
          detail?: string;
          name: string;
          ok: boolean;
          required?: boolean;
          source?: string;
        }>;
        detectedTech: string[];
        ok: boolean;
      };
      expect(output.ok).toBe(true);
      expect(output.detectedTech).toEqual([]);
      expect(output.checks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "Node.js runtime", ok: true }),
          expect.objectContaining({ name: "npm package manager", ok: true }),
          expect.objectContaining({ name: "Git", ok: true }),
        ]),
      );
      expect(output.checks.find((check) => check.name === "Git")).toMatchObject({
        detail: expect.stringContaining("not detected"),
        required: false,
      });
    } finally {
      process.env.PATH = originalPath;
    }
  });

  it("uses persisted current_stage and reports detected technology setup", async () => {
    const project = await createTypeScriptFixtureProject("aiq-cli-doctor-progress-");
    await mkdir(path.join(project.root, ".aiq"), { recursive: true });
    await writeFile(
      path.join(project.root, ".aiq", "progress.json"),
      `${JSON.stringify({ current_stage: 3, disabled: [], order: [0, 1, 2, 3], last_run: null })}\n`,
      "utf8",
    );
    const stdout = new MemoryOutput();
    const stderr = new MemoryOutput();

    const exitCode = await runCli(["node", "aiq", "doctor", "--format", "json"], {
      cwd: project.root,
      stderr,
      stdin: new MemoryInput(),
      stdout,
    });

    expect(exitCode).toBe(1);
    expect(stderr.value).toBe("");
    const output = JSON.parse(stdout.value) as {
      checks: Array<{
        detail?: string;
        name: string;
        ok: boolean;
        required?: boolean;
        source?: string;
      }>;
      detectedTech: string[];
      ok: boolean;
      stages: string[];
    };
    expect(output.ok).toBe(false);
    expect(output.stages).toEqual(["e2e", "lint", "format", "typecheck"]);
    expect(output.detectedTech).toEqual(["TypeScript"]);
    expect(output.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Biome native config", ok: true, source: "project" }),
        expect.objectContaining({
          name: "JS/TS e2e config",
          ok: false,
          required: true,
          source: "project",
        }),
        expect.objectContaining({
          name: "TypeScript project config",
          ok: true,
          required: true,
          source: "project",
        }),
        expect.objectContaining({ name: "Biome JS/TS lint/format tool", source: "bundled" }),
        expect.objectContaining({ name: "TypeScript compiler", source: "bundled" }),
      ]),
    );
  });
});
