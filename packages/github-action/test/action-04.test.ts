import { describe, expect, it, vi } from "vitest";
import {
  os,
  path,
  MemoryGitHubActionIo,
  access,
  createGitRepo,
  createRunResult,
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
  it("uses persisted current_stage as the default cumulative GitHub Action target", async () => {
    const repoDir = await createGitRepo({
      "src/index.ts": "const value = 1;\nexport { value };\n",
    });
    await mkdir(path.join(repoDir, ".aiq"), { recursive: true });
    await writeFile(
      path.join(repoDir, ".aiq", "progress.json"),
      `${JSON.stringify({ current_stage: 3, disabled: [], order: [0, 1, 2, 3], last_run: null })}\n`,
      "utf8",
    );
    const outDir = path.join(repoDir, ".aiq", "out");
    await mkdir(outDir, { recursive: true });
    const reportPath = path.join(outDir, "aiq.report.json");
    const result = createRunResult({
      cwd: repoDir,
      diagnostics: [],
      outDir,
      reportPath,
      status: "passed",
    });
    await writeFile(reportPath, `${JSON.stringify(result)}\n`, "utf8");
    const resolvedStages: Array<readonly string[] | undefined> = [];
    const io = new MemoryGitHubActionIo();

    const outcome = await runAiqGitHubAction(
      io,
      { cwd: repoDir, files: ["src/index.ts"] },
      {
        resolveConfigImpl: async (options) => {
          resolvedStages.push(options.stages);
          return {
            cadenceStages: [],
            changedOnly: false,
            config: defaultConfig,
            cwd: repoDir,
            stages: [...(options.stages ?? [])],
            profile: "deep",
            publishDiagnostics: true,
            source: "defaults",
            surface: "github",
          };
        },
        runEngineImpl: async () => result,
      },
    );

    expect(resolvedStages).toEqual([["e2e", "lint", "format", "typecheck"]]);
    expect(outcome.workflow).toMatchObject({
      currentStage: { id: "typecheck", index: 3 },
      selectedStages: ["e2e", "lint", "format", "typecheck"],
    });
    expect(io.outputs.get("current-stage")).toBe(3);
    expect(io.outputs.get("stages")).toBe("e2e,lint,format,typecheck");
  });
});
