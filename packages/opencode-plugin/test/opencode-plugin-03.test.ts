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
  it("builds OpenCode hooks with the expected aiq_check_files tool", async () => {
    const hooks = await buildAiqOpenCodeHooks({
      directory: "/tmp/project",
    });

    expect(hooks).toHaveProperty("tool.aiq_check_files");
    expect(hooks).toHaveProperty("tool.aiq_plan_files");
    expect(hooks).toHaveProperty("tool.aiq_status");
    expect(hooks).toHaveProperty("tool.aiq_doctor");
  });
});
