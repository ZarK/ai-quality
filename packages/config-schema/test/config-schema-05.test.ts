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
  it("discovers progress state from ancestor .aiq directory", async () => {
    const repoDir = await mkdtemp(path.join(os.tmpdir(), "aiq-progress-"));
    tempDirs.push(repoDir);

    await mkdir(path.join(repoDir, ".aiq"), { recursive: true });
    await mkdir(path.join(repoDir, "packages", "app"), { recursive: true });
    await writeFile(path.join(repoDir, ".aiq", "progress.json"), '{"current_stage":3}\n');

    const discovered = await findAiqProgressFile(path.join(repoDir, "packages", "app"));

    expect(discovered).toBe(path.join(repoDir, ".aiq", "progress.json"));
  });
});
