import { describe, expect, it, vi } from "vitest";
import {
  os,
  path,
  MemoryGitHubActionIo,
  access,
  createGitRepo,
  defaultConfig,
  execFile,
  execFileAsync,
  mkdir,
  mkdtemp,
  parseGitHubActionStageInput,
  parsePositiveInteger,
  promisify,
  readFile,
  rm,
  runAiqGitHubAction,
  tempDirs,
  writeFile,
} from "./action-test-helpers.js";

describe("github action adapter", () => {
  it("publishes a passing run without failure messages", async () => {
    const repoDir = await createGitRepo({
      "src/index.ts": "const passing = 1;\nexport { passing };\n",
    });
    const io = new MemoryGitHubActionIo();

    const outcome = await runAiqGitHubAction(io, {
      cwd: repoDir,
      stages: ["lint"],
    });

    expect(outcome.report?.ok).toBe(true);
    expect(io.annotations).toEqual([]);
    expect(io.failedMessages).toEqual([]);
    expect(io.outputs.get("ok")).toBe(true);
    expect(io.outputs.get("status")).toBe("passed");
    expect(io.uploads).toHaveLength(1);
  });
});
