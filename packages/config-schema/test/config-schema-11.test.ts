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
  it("resolves modular stage language tool selections for requested stages", async () => {
    const repoDir = await mkdtemp(path.join(os.tmpdir(), "aiq-config-"));
    tempDirs.push(repoDir);

    await writeFile(
      path.join(repoDir, "aiq.config.json"),
      `${JSON.stringify(
        {
          version: 1,
          stages: {
            lint: {
              languages: {
                javascript: {
                  enabled: false,
                  tool: "biome",
                },
                python: {
                  enabled: true,
                  tool: "python",
                },
              },
            },
            unit: {
              languages: {
                javascript: {
                  enabled: false,
                  tool: "javascript",
                },
                typescript: {
                  enabled: true,
                  tool: "javascript",
                },
              },
            },
          },
        },
        null,
        2,
      )}\n`,
    );

    const resolved = await resolveAiqConfig({
      cwd: repoDir,
      stages: ["lint", "unit"],
      surface: "cli",
    });

    const stageConfigurations = resolved.stageConfigurations;
    expect(stageConfigurations).toBeDefined();
    expect(stageConfigurations?.lint?.languages.javascript).toBeUndefined();
    expect(stageConfigurations?.lint?.languages.python).toEqual({ toolId: "python" });
    expect(stageConfigurations?.unit?.languages.javascript).toBeUndefined();
    expect(stageConfigurations?.unit?.languages.typescript).toEqual({
      toolId: "javascript",
    });
    expect(resolved.config.stages.lint.languages.javascript).toEqual({
      enabled: false,
      tool: "biome",
    });
  });
});
