import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import { AiqHookCancelledError, renderPreCommitHookScript, runAiqHook } from "../src/index.js";

const execFileAsync = promisify(execFile);
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe("hook adapter", () => {
  it("runs AIQ on staged files and returns failing diagnostics", async () => {
    const repoDir = await createGitRepo({
      "src/index.ts": "var failing = 1;\nexport { failing };\n",
    });

    const result = await runAiqHook({ cwd: repoDir });

    expect(result.skipped).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.ok).toBe(false);
    expect(result.stagedFiles).toEqual([path.join(repoDir, "src/index.ts")]);
    expect(result.result?.context).toBe("hook");
    expect(result.result?.request.context).toBe("hook");
    expect(result.result?.summary.diagnosticCount).toBeGreaterThan(0);
    expect(result.result?.artifacts.reportPath).toBeDefined();

    const reportPath = result.result?.artifacts.reportPath;
    if (reportPath === undefined) {
      throw new Error("Expected report artifact path for hook run.");
    }

    const reportJson = JSON.parse(await readFile(reportPath, "utf8")) as {
      artifactType: string;
      context: string;
    };
    expect(reportJson.artifactType).toBe("report");
    expect(reportJson.context).toBe("hook");
  });

  it("skips cleanly when nothing is staged", async () => {
    const repoDir = await createGitRepo();

    const result = await runAiqHook({ cwd: repoDir, writeArtifacts: false });

    expect(result).toEqual({
      exitCode: 0,
      ok: true,
      skipped: true,
      stagedFiles: [],
    });
  });

  it("only checks staged files and ignores unstaged tracked changes", async () => {
    const repoDir = await createCommittedGitRepo({
      "src/staged.ts": "const staged = 1;\nexport { staged };\n",
      "src/unstaged.ts": "const clean = 1;\nexport { clean };\n",
    });

    await writeFile(
      path.join(repoDir, "src", "staged.ts"),
      "var staged = 1;\nexport { staged };\n",
      "utf8",
    );
    await execFileAsync("git", ["add", "src/staged.ts"], { cwd: repoDir });
    await writeFile(
      path.join(repoDir, "src", "unstaged.ts"),
      "var unstaged = 2;\nexport { unstaged };\n",
      "utf8",
    );

    const result = await runAiqHook({ cwd: repoDir, writeArtifacts: false });

    expect(result.stagedFiles).toEqual([path.join(repoDir, "src", "staged.ts")]);
    expect(result.result?.request.manifest.files).toEqual([path.join(repoDir, "src", "staged.ts")]);
  });

  it("preserves staged filenames with leading whitespace", async () => {
    const repoDir = await createGitRepo({
      "src/ leading.ts": "const spaced = 1;\nexport { spaced };\n",
    });

    const result = await runAiqHook({ cwd: repoDir, stages: ["lint"], writeArtifacts: false });

    expect(result.stagedFiles).toEqual([path.join(repoDir, "src", " leading.ts")]);
    expect(result.result?.request.manifest.files).toEqual([
      path.join(repoDir, "src", " leading.ts"),
    ]);
  });

  it("throws when the hook is cancelled before git diff runs", async () => {
    const repoDir = await createGitRepo();
    const controller = new AbortController();
    controller.abort();

    await expect(
      runAiqHook({ cwd: repoDir, signal: controller.signal, writeArtifacts: false }),
    ).rejects.toBeInstanceOf(AiqHookCancelledError);
  });

  it("renders a pre-commit shim that invokes the local aiq-hook binary", () => {
    const script = renderPreCommitHookScript();

    expect(script).toContain("#!/usr/bin/env sh");
    expect(script).toContain("git rev-parse --show-toplevel");
    expect(script).toContain("node_modules/.bin/aiq-hook");
  });
});

async function createGitRepo(files: Record<string, string> = {}): Promise<string> {
  const repoDir = await mkdtemp(path.join(os.tmpdir(), "aiq-hook-"));
  tempDirs.push(repoDir);

  await execFileAsync("git", ["init"], { cwd: repoDir });

  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = path.join(repoDir, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, contents, "utf8");
    await execFileAsync("git", ["add", relativePath], { cwd: repoDir });
  }

  return repoDir;
}

async function createCommittedGitRepo(files: Record<string, string>): Promise<string> {
  const repoDir = await createGitRepo(files);
  await execFileAsync(
    "git",
    ["-c", "user.name=AIQ", "-c", "user.email=aiq@example.com", "commit", "-m", "init"],
    { cwd: repoDir },
  );
  return repoDir;
}
