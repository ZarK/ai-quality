import { describe, expect, it, vi } from "vitest";
import {
  os,
  path,
  AiqMcpAdapter,
  aiqExplainDiagnosticsInputSchema,
  createAiqMcpServer,
  defaultConfig,
  formatDiagnosticExplanation,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  tempDirs,
  writeFile,
} from "./mcp-test-helpers.js";

describe("MCP adapter", () => {
  it("formats empty diagnostic explanations", () => {
    expect(
      formatDiagnosticExplanation({
        artifactType: "report",
        artifactVersion: 1,
        artifacts: { outDir: "/tmp/out" },
        context: "mcp",
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
          context: "mcp",
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
          context: "mcp",
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
      }),
    ).toBe("AIQ found no diagnostics.");
  });
});
