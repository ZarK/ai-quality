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
  it("lets invocation overrides win over surface and profile defaults", async () => {
    const repoDir = await mkdtemp(path.join(os.tmpdir(), "aiq-config-"));
    tempDirs.push(repoDir);

    await writeFile(
      path.join(repoDir, "aiq.config.json"),
      `${JSON.stringify(
        {
          version: 1,
          profiles: {
            deep: {
              changedOnly: true,
              stages: ["lint", "security"],
            },
          },
          surfaces: {
            cli: {
              profile: "standard",
            },
          },
        },
        null,
        2,
      )}\n`,
    );

    const resolved = await resolveAiqConfig({
      cwd: repoDir,
      stages: ["security"],
      profile: "deep",
      surface: "cli",
    });

    expect(resolved.profile).toBe("deep");
    expect(resolved.changedOnly).toBe(true);
    expect(resolved.stages).toEqual(["security"]);
  });
});
