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
});
