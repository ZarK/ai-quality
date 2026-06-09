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
  it("fails fast on unsupported stage languages and tool ids", () => {
    expect(() =>
      validateAiqConfigFile({
        version: 1,
        stages: {
          lint: {
            languages: {
              csharp: {
                enabled: true,
                tool: "dotnet",
              },
            },
          },
        },
      }),
    ).toThrowError("contains unsupported language 'csharp'");

    expect(() =>
      validateAiqConfigFile({
        version: 1,
        stages: {
          lint: {
            languages: {
              javascript: {
                enabled: true,
                tool: "bogus",
              },
            },
          },
        },
      }),
    ).toThrowError("tool must be one of");

    expect(() =>
      validateAiqConfigFile({
        version: 1,
        stages: {
          unit: {
            languages: {
              typescript: {
                enabled: true,
                tool: "typescript",
              },
            },
          },
        },
      }),
    ).toThrowError("unsupported for stage 'unit'");
  });
});
