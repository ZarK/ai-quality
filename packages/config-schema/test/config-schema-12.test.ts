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
  it("omits stage configurations when using defaults without a repo config", async () => {
    const repoDir = await mkdtemp(path.join(os.tmpdir(), "aiq-config-defaults-"));
    tempDirs.push(repoDir);

    const resolved = await resolveAiqConfig({
      cwd: repoDir,
      stages: ["lint", "unit"],
      surface: "cli",
    });

    expect(resolved.source).toBe("defaults");
    expect(resolved.stageConfigurations).toBeUndefined();
  });
});
