import { describe, expect, it, vi } from "vitest";
import {
  os,
  path,
  AiqOpenCodeAdapter,
  buildAiqOpenCodeHooks,
  createWorkspace,
  defaultConfig,
  formatAiqOpenCodeResult,
  mkdir,
  mkdtemp,
  rm,
  tempDirs,
  writeFile,
} from "./opencode-plugin-test-helpers.js";

describe("OpenCode adapter", () => {
  it("uses persisted current_stage for OpenCode run, plan, and status defaults", async () => {
    const repoDir = await createWorkspace({
      "src/index.ts": "const ok = 1;\nexport { ok };\n",
    });
    await mkdir(path.join(repoDir, ".aiq"), { recursive: true });
    await writeFile(
      path.join(repoDir, ".aiq", "progress.json"),
      `${JSON.stringify({ current_stage: 3, disabled: [], order: [0, 1, 2, 3], last_run: null })}\n`,
      "utf8",
    );
    const adapter = new AiqOpenCodeAdapter({
      cwd: repoDir,
      runEngineImpl: async (request) => ({
        artifactType: "report",
        artifactVersion: 1,
        artifacts: { outDir: path.join(repoDir, ".aiq", "out") },
        context: "opencode",
        durationMs: 1,
        engineVersion: "0.0.0",
        finishedAt: "2026-03-23T00:00:00.000Z",
        mode: "check",
        ok: true,
        stages: [],
        plan: {
          artifactType: "plan",
          artifactVersion: 1,
          artifacts: { outDir: path.join(repoDir, ".aiq", "out") },
          context: "opencode",
          createdAt: "2026-03-23T00:00:00.000Z",
          engineVersion: "0.0.0",
          input: {
            entries: [],
            files: [],
            root: repoDir,
            source: "direct",
            summary: { fileCount: 1 },
          },
          stages: [...(request.stages ?? [])],
          profile: request.profile ?? "fast",
          runId: "run_123",
          summary: { fileCount: 1, stageCount: request.stages?.length ?? 0, taskCount: 0 },
          tasks: [],
        },
        request: {
          context: "opencode",
          cwd: repoDir,
          manifest: {
            entries: [],
            files: [],
            root: repoDir,
            source: "direct",
            summary: { fileCount: 1 },
          },
          mode: "check",
          outDir: path.join(repoDir, ".aiq", "out"),
          selection: { stages: [...(request.stages ?? [])], profile: request.profile ?? "fast" },
          writeArtifacts: false,
        },
        runId: "run_123",
        startedAt: "2026-03-23T00:00:00.000Z",
        summary: {
          cacheHitCount: 0,
          cacheHitRate: 0,
          cacheMissCount: 0,
          diagnosticCount: 0,
          durationMs: 1,
          fileCount: 1,
          notImplementedStageCount: 0,
          stageCount: request.stages?.length ?? 0,
          status: "passed",
          taskCount: 0,
          toolDurationMs: 0,
          toolRunCount: 0,
        },
      }),
    });

    const check = await adapter.run({ files: ["src/index.ts"] });
    const blankOverrideCheck = await adapter.run({
      files: ["src/index.ts"],
      profile: " ",
      stages: [" "],
    });
    const plan = await adapter.plan({ files: ["src/index.ts"] });
    const status = await adapter.status();

    expect(check.report.request.selection.stages).toEqual(["e2e", "lint", "format", "typecheck"]);
    expect(blankOverrideCheck.report.request.selection.stages).toEqual([
      "e2e",
      "lint",
      "format",
      "typecheck",
    ]);
    expect(plan.plan.stages).toEqual(["e2e", "lint", "format", "typecheck"]);
    expect(status.workflow).toMatchObject({
      currentStage: { id: "typecheck", index: 3 },
      selectedStages: ["e2e", "lint", "format", "typecheck"],
    });
  });
});
