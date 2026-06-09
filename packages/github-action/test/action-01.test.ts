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
  it("runs AIQ on tracked files, emits annotations, and uploads canonical artifacts", async () => {
    const repoDir = await createGitRepo({
      "src/index.ts": "var failing = 1;\nexport { failing };\n",
    });
    const io = new MemoryGitHubActionIo();

    const outcome = await runAiqGitHubAction(io, {
      artifactName: "aiq-artifact",
      cwd: repoDir,
      stages: ["lint"],
    });

    expect(outcome.skipped).toBe(false);
    expect(outcome.report?.context).toBe("github");
    expect(outcome.report?.request.context).toBe("github");
    expect(io.annotations).not.toHaveLength(0);
    expect(io.annotations[0]).toMatchObject({
      file: "src/index.ts",
      level: "error",
    });
    expect(io.failedMessages).toHaveLength(1);
    expect(io.outputs.get("status")).toBe("failed");
    expect(io.outputs.get("diagnostic-count")).toBeGreaterThan(0);
    expect(io.uploads).toHaveLength(1);
    expect(io.uploads[0]).toMatchObject({
      name: "aiq-artifact",
      rootDirectory: path.join(repoDir, ".aiq", "out"),
    });
    expect(io.uploads[0]?.files.map((file) => path.basename(file)).sort()).toEqual([
      "aiq.plan.json",
      "aiq.report.json",
    ]);

    const reportPath = outcome.report?.artifacts.reportPath;
    if (reportPath === undefined) {
      throw new Error("Expected a GitHub action report artifact path.");
    }

    const reportJson = JSON.parse(await readFile(reportPath, "utf8")) as {
      artifactType: string;
      context: string;
    };
    expect(reportJson.artifactType).toBe("report");
    expect(reportJson.context).toBe("github");
  });
});
