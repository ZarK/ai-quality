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
  it("supports watch cadence and serve surface overrides", async () => {
    const repoDir = await mkdtemp(path.join(os.tmpdir(), "aiq-config-"));
    tempDirs.push(repoDir);

    await writeFile(
      path.join(repoDir, "aiq.config.json"),
      `${JSON.stringify(
        {
          version: 1,
          surfaces: {
            watch: {
              cadenceMs: 25,
              cadenceStages: ["typecheck"],
              profile: "deep",
            },
            serve: {
              profile: "fast",
            },
          },
        },
        null,
        2,
      )}\n`,
    );

    const watchResolved = await resolveAiqConfig({
      cwd: repoDir,
      surface: "watch",
    });
    const serveResolved = await resolveAiqConfig({
      cwd: repoDir,
      surface: "serve",
    });

    expect(watchResolved.profile).toBe("deep");
    expect(watchResolved.stages).toEqual(["lint", "typecheck", "unit", "coverage", "security"]);
    expect(watchResolved.cadenceMs).toBe(25);
    expect(watchResolved.cadenceStages).toEqual(["typecheck"]);
    expect(serveResolved.profile).toBe("fast");
    expect(serveResolved.stages).toEqual(["lint"]);
  });
});
