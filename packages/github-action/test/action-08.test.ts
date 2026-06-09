import { describe, expect, it, vi } from "vitest";
import {
  os,
  path,
  access,
  createGitRepo,
  defaultConfig,
  execFile,
  execFileAsync,
  mkdir,
  mkdtemp,
  parseGitHubActionStageInput,
  parsePositiveInteger,
  promisify,
  readFile,
  rm,
  runAiqGitHubAction,
  tempDirs,
  writeFile,
} from "./action-test-helpers.js";

describe("github action adapter", () => {
  it("keeps the action runtime path pointed at a bundled file", async () => {
    const actionYamlPath = path.resolve("packages/github-action/action.yml");
    const actionYaml = await readFile(actionYamlPath, "utf8");
    const mainMatch = /^\s*main:\s*(.+)$/mu.exec(actionYaml);
    const runtimePath = path.resolve(path.dirname(actionYamlPath), mainMatch?.[1] ?? "missing");

    expect(mainMatch?.[1]).toBe("dist/main.mjs");
    await expect(access(runtimePath)).resolves.toBeUndefined();

    const runtimeSource = await readFile(runtimePath, "utf8");
    const shebangLines = runtimeSource.split(/\r?\n/u).filter((line) => line.startsWith("#!"));
    expect(shebangLines).toEqual(["#!/usr/bin/env node"]);

    const repoDir = await createGitRepo({
      "src/index.ts": "const bundled = 1;\nexport { bundled };\n",
    });
    const result = await execFileAsync(process.execPath, [runtimePath], {
      cwd: repoDir,
      env: {
        ...process.env,
        GITHUB_WORKSPACE: repoDir,
        INPUT_ANNOTATE: "false",
        INPUT_FILES: "src/index.ts",
        INPUT_STAGES: "lint",
        "INPUT_UPLOAD-ARTIFACT": "false",
      },
    });

    expect(result.stderr).not.toContain("Dynamic require");
    expect(result.stderr).not.toContain("SyntaxError");
    expect(result.stdout).toContain("AIQ check");
  });
});
