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
  it("loads defaults and persists validated progress stage", async () => {
    const repoDir = await mkdtemp(path.join(os.tmpdir(), "aiq-progress-"));
    tempDirs.push(repoDir);

    const defaults = await loadAiqProgress(repoDir);
    expect(defaults.source).toBe("defaults");
    expect(defaults.progress).toEqual(defaultProgressState);

    const saved = await setAiqProgressStage(repoDir, 6);
    expect(saved.source).toBe("file");
    expect(saved.progress.current_stage).toBe(6);

    const reloaded = await loadAiqProgress(repoDir);
    expect(reloaded.source).toBe("file");
    expect(reloaded.progress.current_stage).toBe(6);
  });
});
