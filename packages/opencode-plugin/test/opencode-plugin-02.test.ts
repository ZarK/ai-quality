import { describe, expect, it, vi } from "vitest";
import {
  os,
  path,
  AiqOpenCodeAdapter,
  buildAiqOpenCodeHooks,
  createWorkspace,
  defaultConfig,
  formatAiqOpenCodeResult,
  mkdir,
  mkdtemp,
  rm,
  tempDirs,
  writeFile,
} from "./opencode-plugin-test-helpers.js";

describe("OpenCode adapter", () => {
  it("hides diagnostics in the tool-facing result when opencode publishDiagnostics is disabled", async () => {
    const repoDir = await createWorkspace({
      "src/index.ts": "var failing = 1;\nexport { failing };\n",
    });

    const adapter = new AiqOpenCodeAdapter({
      cwd: repoDir,
      stages: ["lint"],
      resolveConfigImpl: async () => ({
        cadenceStages: [],
        changedOnly: true,
        config: defaultConfig,
        cwd: repoDir,
        stages: ["lint"],
        stageConfigurations: {
          lint: {
            languages: {
              typescript: {
                toolId: "biome",
              },
            },
          },
        },
        profile: "fast",
        publishDiagnostics: false,
        source: "defaults",
        surface: "opencode",
      }),
      writeArtifacts: false,
    });

    const result = await adapter.run({ files: ["src/index.ts"] });

    expect(result.publishDiagnostics).toBe(false);
    expect(result.diagnostics).toEqual([]);
    expect(result.text).toContain("Diagnostics are hidden");
  });
});
