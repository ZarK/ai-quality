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
  it("resolves repo config, profile defaults, surface overrides, and stage filtering", async () => {
    const repoDir = await mkdtemp(path.join(os.tmpdir(), "aiq-config-"));
    tempDirs.push(repoDir);

    await mkdir(path.join(repoDir, ".aiq"), { recursive: true });
    await mkdir(path.join(repoDir, "packages", "app"), { recursive: true });
    await writeFile(
      path.join(repoDir, ".aiq", "aiq.config.json"),
      `${JSON.stringify(
        {
          version: 1,
          inputs: {
            ignore: ["dist/**"],
          },
          stages: {
            coverage: {
              enabled: false,
            },
          },
          profiles: {
            standard: {
              changedOnly: false,
              stages: ["lint", "unit", "coverage"],
            },
          },
          surfaces: {
            cli: {
              changedOnly: true,
              stages: ["unit", "coverage"],
              profile: "standard",
              publishDiagnostics: true,
            },
          },
        },
        null,
        2,
      )}\n`,
    );

    const resolved = await resolveAiqConfig({
      cwd: path.join(repoDir, "packages", "app"),
      surface: "cli",
    });

    expect(resolved.source).toBe("file");
    expect(resolved.profile).toBe("standard");
    expect(resolved.changedOnly).toBe(true);
    expect(resolved.publishDiagnostics).toBe(true);
    expect(resolved.stages).toEqual(["unit"]);
    expect(resolved.config.inputs.ignore).toEqual(["dist/**"]);
  });
});
