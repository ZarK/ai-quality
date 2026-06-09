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
  it("fails fast on invalid progress state", () => {
    expect(() => validateAiqProgressState({ current_stage: 10 })).toThrowError(
      "current_stage must be a stage index from 0 to 9",
    );
    expect(() => validateAiqProgressState({ current_stage: 1, disabled: ["lint"] })).toThrowError(
      "disabled[0] must be a stage index from 0 to 9",
    );
    expect(() => validateAiqProgressState({ current_stage: 1, unexpected: true })).toThrowError(
      "contains unsupported key 'unexpected'",
    );
  });
});
