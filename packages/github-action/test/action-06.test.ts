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
  it("rejects malformed max-annotation input", () => {
    expect(parsePositiveInteger("5", "max-annotations")).toBe(5);
    expect(() => parsePositiveInteger("5.5", "max-annotations")).toThrowError(
      "max-annotations must be a non-negative integer.",
    );
    expect(() => parsePositiveInteger("5oops", "max-annotations")).toThrowError(
      "max-annotations must be a non-negative integer.",
    );
  });
});
