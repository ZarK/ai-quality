import { describe, expect, it, vi } from "vitest";
import {
  os,
  path,
  aiqLanguageIds,
  aiqStageIds,
  aiqStageLadderIds,
  aiqSurfaceIds,
  createAiqProgressRunSelection,
  defaultProgressState,
  findAiqConfigFile,
  findAiqProgressFile,
  initializeAiqProjectConfig,
  languageIds,
  loadAiqConfig,
  loadAiqProgress,
  mkdir,
  mkdtemp,
  readFile,
  resolveAiqConfig,
  resolveAiqProgressStageIds,
  resolveAiqProgressStageIndex,
  rm,
  setAiqProgressStage,
  stageIds,
  surfaceIds,
  tempDirs,
  validateAiqConfigFile,
  validateAiqProgressState,
  writeFile,
} from "./config-schema-test-helpers.js";

describe("config schema", () => {
  it("maps progress current_stage to the canonical cumulative stage ladder", async () => {
    const repoDir = await mkdtemp(path.join(os.tmpdir(), "aiq-progress-ladder-"));
    tempDirs.push(repoDir);

    await mkdir(path.join(repoDir, ".aiq"), { recursive: true });
    await writeFile(
      path.join(repoDir, ".aiq", "progress.json"),
      `${JSON.stringify({ current_stage: 3, disabled: [], order: [0, 1, 2, 3], last_run: null })}\n`,
    );

    const loaded = await loadAiqProgress(repoDir);
    const stages = resolveAiqProgressStageIds(loaded.progress.current_stage);
    const workflow = createAiqProgressRunSelection(loaded, stages);

    expect(aiqStageLadderIds).toEqual([
      "e2e",
      "lint",
      "format",
      "typecheck",
      "unit",
      "sloc",
      "complexity",
      "maintainability",
      "coverage",
      "security",
    ]);
    expect(stages).toEqual(["e2e", "lint", "format", "typecheck"]);
    expect(workflow).toMatchObject({
      currentStage: { id: "typecheck", index: 3, name: "typecheck" },
      defaultRun: {
        range: "0..3",
        stages: [
          { id: "e2e", index: 0 },
          { id: "lint", index: 1 },
          { id: "format", index: 2 },
          { id: "typecheck", index: 3 },
        ],
      },
      progressPath: path.join(repoDir, ".aiq", "progress.json"),
      progressSource: "file",
      selectedStages: ["e2e", "lint", "format", "typecheck"],
    });
  });
});
