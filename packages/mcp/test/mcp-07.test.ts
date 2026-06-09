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
});
