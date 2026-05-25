import path from "node:path";

import { describe, expect, it } from "vitest";
import type { RunResult } from "../../model/src/index.js";
import { collectGitHubAnnotations, formatRunResultAsGitHubAnnotations } from "../src/index.js";

describe("reporters", () => {
  it("maps engine diagnostics to GitHub annotations with relative paths", () => {
    const workspaceRoot = path.join(path.sep, "repo");
    const result = createRunResult({
      cwd: workspaceRoot,
      diagnostics: [
        {
          code: "lint/style/noVar",
          file: path.join(workspaceRoot, "src", "index.ts"),
          message: "Unexpected var, use let or const instead.",
          range: {
            endColumn: 4,
            endLine: 1,
            startColumn: 1,
            startLine: 1,
          },
          severity: "error",
          source: "biome",
        },
      ],
    });

    const annotations = collectGitHubAnnotations(result);

    expect(annotations).toEqual([
      {
        endColumn: 4,
        endLine: 1,
        file: "src/index.ts",
        level: "error",
        message: "Unexpected var, use let or const instead.",
        startColumn: 1,
        startLine: 1,
        title: "AIQ/biome lint/style/noVar",
      },
    ]);
  });

  it("formats workflow commands and escapes multiline messages", () => {
    const workspaceRoot = path.join(path.sep, "repo");
    const result = createRunResult({
      cwd: workspaceRoot,
      diagnostics: [
        {
          file: path.join(workspaceRoot, "README.md"),
          message: "Line one\nLine two",
          severity: "warning",
          source: "aiq",
        },
      ],
    });

    const output = formatRunResultAsGitHubAnnotations(result);

    expect(output).toBe("::warning file=README.md,title=AIQ/aiq::Line one%0ALine two\n");
  });
});

function createRunResult(options: {
  cwd: string;
  diagnostics: Array<{
    code?: string;
    file: string;
    message: string;
    range?: {
      endColumn?: number;
      endLine?: number;
      startColumn: number;
      startLine: number;
    };
    severity: "error" | "info" | "warning";
    source: string;
  }>;
}): RunResult {
  const result: RunResult = {
    artifactType: "report",
    artifactVersion: 1,
    artifacts: {
      outDir: path.join(options.cwd, ".aiq", "out"),
      planPath: path.join(options.cwd, ".aiq", "out", "aiq.plan.json"),
      reportPath: path.join(options.cwd, ".aiq", "out", "aiq.report.json"),
    },
    context: "github",
    durationMs: 1,
    engineVersion: "0.0.0",
    finishedAt: "2026-03-23T00:00:00.000Z",
    mode: "check",
    ok: options.diagnostics.length === 0,
    stages: [
      {
        diagnostics: options.diagnostics,
        durationMs: 1,
        notes: [],
        stageId: "lint",
        status: options.diagnostics.length === 0 ? "passed" : "failed",
        toolRuns: [],
      },
    ],
    plan: {
      artifactType: "plan",
      artifactVersion: 1,
      artifacts: {
        outDir: path.join(options.cwd, ".aiq", "out"),
      },
      context: "github",
      createdAt: "2026-03-23T00:00:00.000Z",
      engineVersion: "0.0.0",
      input: {
        entries: options.diagnostics.map((diagnostic) => ({
          extension: path.extname(diagnostic.file),
          path: diagnostic.file,
        })),
        files: options.diagnostics.map((diagnostic) => diagnostic.file),
        root: options.cwd,
        source: "direct",
        summary: {
          fileCount: options.diagnostics.length,
        },
      },
      stages: ["lint"],
      profile: "deep",
      runId: "run_123",
      summary: {
        fileCount: options.diagnostics.length,
        stageCount: 1,
        taskCount: 1,
      },
      tasks: [
        {
          fileCount: options.diagnostics.length,
          files: options.diagnostics.map((diagnostic) => diagnostic.file),
          id: "task_123",
          stageId: "lint",
        },
      ],
    },
    request: {
      context: "github",
      cwd: options.cwd,
      manifest: {
        entries: options.diagnostics.map((diagnostic) => ({
          extension: path.extname(diagnostic.file),
          path: diagnostic.file,
        })),
        files: options.diagnostics.map((diagnostic) => diagnostic.file),
        root: options.cwd,
        source: "direct",
        summary: {
          fileCount: options.diagnostics.length,
        },
      },
      mode: "check",
      outDir: path.join(options.cwd, ".aiq", "out"),
      selection: {
        stages: ["lint"],
        profile: "deep",
      },
      writeArtifacts: true,
    },
    runId: "run_123",
    startedAt: "2026-03-23T00:00:00.000Z",
    summary: {
      cacheHitCount: 0,
      cacheHitRate: 0,
      cacheMissCount: 0,
      diagnosticCount: options.diagnostics.length,
      durationMs: 1,
      fileCount: options.diagnostics.length,
      notImplementedStageCount: 0,
      stageCount: 1,
      status: options.diagnostics.length === 0 ? "passed" : "failed",
      taskCount: 1,
      toolDurationMs: 0,
      toolRunCount: 0,
    },
  };

  return result;
}
