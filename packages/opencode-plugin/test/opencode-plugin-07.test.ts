import { describe, expect, it, vi } from "vitest";
import {
  os,
  path,
  AiqOpenCodeAdapter,
  buildAiqOpenCodeHooks,
  defaultConfig,
  formatAiqOpenCodeResult,
  mkdir,
  mkdtemp,
  rm,
  tempDirs,
  writeFile,
} from "./opencode-plugin-test-helpers.js";

describe("OpenCode adapter", () => {
  it("formats hidden diagnostics consistently", () => {
    expect(
      formatAiqOpenCodeResult(
        {
          artifactType: "report",
          artifactVersion: 1,
          artifacts: { outDir: "/tmp/out" },
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
            artifacts: { outDir: "/tmp/out" },
            context: "opencode",
            createdAt: "2026-03-23T00:00:00.000Z",
            engineVersion: "0.0.0",
            input: {
              entries: [],
              files: [],
              root: "/tmp/project",
              source: "direct",
              summary: { fileCount: 0 },
            },
            stages: [],
            profile: "fast",
            runId: "run_123",
            summary: { fileCount: 0, stageCount: 0, taskCount: 0 },
            tasks: [],
          },
          request: {
            context: "opencode",
            cwd: "/tmp/project",
            manifest: {
              entries: [],
              files: [],
              root: "/tmp/project",
              source: "direct",
              summary: { fileCount: 0 },
            },
            mode: "check",
            outDir: "/tmp/out",
            selection: {
              stages: [],
              profile: "fast",
            },
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
            fileCount: 0,
            notImplementedStageCount: 0,
            stageCount: 0,
            status: "passed",
            taskCount: 0,
            toolDurationMs: 0,
            toolRunCount: 0,
          },
        },
        false,
      ),
    ).toContain("Diagnostics are hidden");
  });
});
