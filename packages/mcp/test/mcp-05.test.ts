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
  it("rejects explain requests that provide neither files nor reportPath", async () => {
    const repoDir = await createWorkspace("const ok = 1;\nexport { ok };\n");
    const adapter = new AiqMcpAdapter({ cwd: repoDir, stages: ["lint"] });

    expect(aiqExplainDiagnosticsInputSchema.safeParse({}).success).toBe(false);
    expect(aiqExplainDiagnosticsInputSchema.safeParse({ reportPath: "   " }).success).toBe(false);
    await expect(adapter.explain({})).rejects.toThrowError("Provide files or reportPath.");
  });
});
