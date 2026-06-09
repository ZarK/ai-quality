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
  it("initializes canonical config and progress state", async () => {
    const repoDir = await mkdtemp(path.join(os.tmpdir(), "aiq-init-"));
    tempDirs.push(repoDir);

    const result = await initializeAiqProjectConfig(repoDir);

    expect(result).toEqual({
      configCreated: true,
      configPath: path.join(repoDir, ".aiq", "aiq.config.json"),
      progressCreated: true,
      progressPath: path.join(repoDir, ".aiq", "progress.json"),
    });
    expect(JSON.parse(await readFile(result.configPath, "utf8"))).toEqual({ version: 1 });
    expect(JSON.parse(await readFile(result.progressPath, "utf8"))).toEqual(defaultProgressState);
  });
});
