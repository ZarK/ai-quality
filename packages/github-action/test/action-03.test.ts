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
  it("respects github publishDiagnostics=false while still uploading artifacts", async () => {
    const repoDir = await createGitRepo(
      {
        "src/index.ts": "var failing = 1;\nexport { failing };\n",
      },
      {
        version: 1,
        profiles: {
          fast: {
            changedOnly: false,
            stages: ["lint"],
          },
        },
        surfaces: {
          github: {
            profile: "fast",
            publishDiagnostics: false,
          },
        },
      },
    );
    const io = new MemoryGitHubActionIo();

    const outcome = await runAiqGitHubAction(io, { cwd: repoDir });

    expect(outcome.report?.ok).toBe(false);
    expect(io.annotations).toEqual([]);
    expect(io.failedMessages).toHaveLength(1);
    expect(io.uploads).toHaveLength(1);
  });
});
