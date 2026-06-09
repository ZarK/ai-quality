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
  it("keeps explicit invocation stages even when the repo disables them", async () => {
    const repoDir = await mkdtemp(path.join(os.tmpdir(), "aiq-config-"));
    tempDirs.push(repoDir);

    await writeFile(
      path.join(repoDir, "aiq.config.json"),
      `${JSON.stringify(
        {
          version: 1,
          stages: {
            security: {
              enabled: false,
            },
          },
          surfaces: {
            cli: {
              profile: "fast",
            },
          },
        },
        null,
        2,
      )}\n`,
    );

    const resolved = await resolveAiqConfig({
      cwd: repoDir,
      stages: ["security", "security"],
      surface: "cli",
    });

    expect(resolved.stages).toEqual(["security"]);
  });
});
