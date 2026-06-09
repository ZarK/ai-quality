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
  it("runs AIQ on explicit files with read-only defaults", async () => {
    const repoDir = await createWorkspace({
      "src/index.ts": "var failing = 1;\nexport { failing };\n",
    });

    const adapter = new AiqOpenCodeAdapter({
      cwd: repoDir,
      stages: ["lint"],
    });
    const result = await adapter.run({
      files: ["src/index.ts"],
    });

    expect(result.ok).toBe(false);
    expect(result.files).toEqual([path.join(repoDir, "src/index.ts")]);
    expect(result.report.context).toBe("opencode");
    expect(result.report.request.context).toBe("opencode");
    expect(result.publishDiagnostics).toBe(true);
    expect(result.diagnostics).not.toHaveLength(0);
    expect(result.planPath).toBeUndefined();
    expect(result.reportPath).toBeUndefined();
    expect(result.text).toContain("AIQ check");
  });
});
