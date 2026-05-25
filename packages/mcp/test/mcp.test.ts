import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { defaultConfig } from "../../config-schema/src/index.js";
import type { RunResult, StageId } from "../../model/src/index.js";

import {
  AiqMcpAdapter,
  aiqExplainDiagnosticsInputSchema,
  createAiqMcpServer,
  formatDiagnosticExplanation,
} from "../src/index.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

describe("MCP adapter", () => {
  it("runs AIQ checks for explicit files without exposing a fix path", async () => {
    const repoDir = await createWorkspace("var failing = 1;\nexport { failing };\n");
    const adapter = new AiqMcpAdapter({
      cwd: repoDir,
      stages: ["lint"],
    });

    const result = await adapter.check({
      files: ["index.ts"],
    });

    expect(result.ok).toBe(false);
    expect(result.files).toEqual([path.join(repoDir, "index.ts")]);
    expect(result.report.context).toBe("mcp");
    expect(result.report.request.context).toBe("mcp");
    expect(result.planPath).toBeUndefined();
    expect(result.reportPath).toBeUndefined();
    expect(result.text).toContain("AIQ check");
  });

  it("explains diagnostics from a canonical report artifact", async () => {
    const repoDir = await createWorkspace("var failing = 1;\nexport { failing };\n");
    const adapter = new AiqMcpAdapter({
      cwd: repoDir,
      stages: ["lint"],
      writeArtifacts: true,
    });

    const checkResult = await adapter.check({ files: ["index.ts"] });
    if (checkResult.reportPath === undefined) {
      throw new Error("Expected MCP report path.");
    }

    const explanation = await adapter.explain({ reportPath: checkResult.reportPath });

    expect(explanation.diagnosticCount).toBeGreaterThan(0);
    expect(explanation.text).toContain("AIQ diagnostics:");
    expect(explanation.text).toContain("[error]");
  });

  it("creates an MCP server with explicit check and explain tools", () => {
    const server = createAiqMcpServer({ writeArtifacts: false });
    expect(server).toBeDefined();
  });

  it("rejects explain requests that provide neither files nor reportPath", async () => {
    const repoDir = await createWorkspace("const ok = 1;\nexport { ok };\n");
    const adapter = new AiqMcpAdapter({ cwd: repoDir, stages: ["lint"] });

    expect(aiqExplainDiagnosticsInputSchema.safeParse({}).success).toBe(false);
    expect(aiqExplainDiagnosticsInputSchema.safeParse({ reportPath: "   " }).success).toBe(false);
    await expect(adapter.explain({})).rejects.toThrowError("Provide files or reportPath.");
  });

  it("treats blank reportPath as absent when files are provided", async () => {
    const repoDir = await createWorkspace("var failing = 1;\nexport { failing };\n");
    const adapter = new AiqMcpAdapter({ cwd: repoDir, stages: ["lint"] });

    const explanation = await adapter.explain({
      files: ["index.ts"],
      reportPath: "   ",
    });

    expect(explanation.diagnosticCount).toBeGreaterThan(0);
    expect(explanation.text).toContain("AIQ diagnostics:");
  });

  it("wraps report artifact read failures with the resolved path", async () => {
    const repoDir = await createWorkspace("const ok = 1;\nexport { ok };\n");
    const adapter = new AiqMcpAdapter({ cwd: repoDir, stages: ["lint"] });
    const reportPath = "missing-report.json";

    await expect(adapter.explain({ reportPath })).rejects.toMatchObject({
      message: expect.stringContaining(
        `Failed to read AIQ report artifact at ${path.join(repoDir, reportPath)}:`,
      ),
    });
  });

  it("lets per-call stages and profile override adapter defaults", async () => {
    const resolvedOptions: Array<{ stages?: readonly string[]; profile?: string }> = [];
    const expectedStageConfigurations = {
      typecheck: {
        languages: {
          typescript: {
            toolId: "typescript",
          },
        },
      },
    };
    let forwardedStageConfigurations: RunResult["request"]["selection"]["stageConfigurations"];
    const adapter = new AiqMcpAdapter({
      cwd: "/tmp/project",
      stages: ["lint"],
      profile: "fast",
      resolveConfigImpl: async (options) => {
        resolvedOptions.push({
          ...(options.stages === undefined ? {} : { stages: options.stages }),
          ...(options.profile === undefined ? {} : { profile: options.profile }),
        });

        return {
          cadenceStages: [],
          changedOnly: false,
          config: defaultConfig,
          cwd: "/tmp/project",
          stages: ["typecheck"],
          stageConfigurations: expectedStageConfigurations,
          profile: "deep",
          publishDiagnostics: false,
          source: "defaults",
          surface: "mcp",
        };
      },
      runEngineImpl: async (request): Promise<RunResult> => {
        const selectionStages: StageId[] = [...(request.stages ?? [])];
        forwardedStageConfigurations = request.stageConfigurations;

        return {
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
            profile: request.profile ?? "deep",
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
              stages: selectionStages,
              ...(request.stageConfigurations === undefined
                ? {}
                : { stageConfigurations: request.stageConfigurations }),
              profile: request.profile ?? "deep",
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
        };
      },
    });

    await adapter.check({
      files: ["index.ts"],
      stages: ["typecheck"],
      profile: "deep",
    });

    expect(resolvedOptions).toEqual([{ stages: ["typecheck"], profile: "deep" }]);
    expect(forwardedStageConfigurations).toEqual(expectedStageConfigurations);
  });

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

async function createWorkspace(contents: string): Promise<string> {
  const repoDir = await mkdtemp(path.join(os.tmpdir(), "aiq-mcp-"));
  tempDirs.push(repoDir);

  const filePath = path.join(repoDir, "index.ts");
  await writeFile(filePath, contents, "utf8");
  await readFile(filePath, "utf8");

  return repoDir;
}
