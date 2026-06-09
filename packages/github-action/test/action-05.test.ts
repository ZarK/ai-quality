import { describe, expect, it, vi } from "vitest";
import {
  os,
  path,
  access,
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
  it("parses and de-duplicates stage input", () => {
    expect(parseGitHubActionStageInput(["lint", "lint", "typecheck"])).toEqual([
      "lint",
      "typecheck",
    ]);
  });
});
