import { describe, expect, it, vi } from "vitest";
import {
  os,
  path,
  AiqMcpAdapter,
  aiqExplainDiagnosticsInputSchema,
  createAiqMcpServer,
  createWorkspace,
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
});
