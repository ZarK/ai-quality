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
  safeParseToolSchema,
  tempDirs,
  writeFile,
} from "./opencode-plugin-test-helpers.js";

describe("OpenCode adapter", () => {
  it("rejects empty file lists in the OpenCode tool schema", async () => {
    const hooks = await buildAiqOpenCodeHooks({
      directory: "/tmp/project",
    });
    const aiqCheckFiles = hooks.tool?.aiq_check_files;

    expect(aiqCheckFiles).toBeDefined();
    if (aiqCheckFiles === undefined) {
      throw new Error("Expected aiq_check_files tool.");
    }

    expect(safeParseToolSchema(aiqCheckFiles.args.files, []).success).toBe(false);
    expect(safeParseToolSchema(aiqCheckFiles.args.files, ["src/index.ts"]).success).toBe(true);
  });
});
