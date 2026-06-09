import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { defaultConfig } from "../../config-schema/src/index.js";
import type { RunResult, StageId } from "../../model/src/index.js";

import {
  AiqOpenCodeAdapter,
  buildAiqOpenCodeHooks,
  formatAiqOpenCodeResult,
} from "../src/index.js";

export const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

export async function createWorkspace(files: Record<string, string>): Promise<string> {
  const repoDir = await mkdtemp(path.join(os.tmpdir(), "aiq-opencode-"));
  tempDirs.push(repoDir);

  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = path.join(repoDir, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, contents, "utf8");
  }

  return repoDir;
}

export function safeParseToolSchema(schema: unknown, value: unknown): { success: boolean } {
  if (
    typeof schema !== "object" ||
    schema === null ||
    !("safeParse" in schema) ||
    typeof schema.safeParse !== "function"
  ) {
    throw new TypeError("Expected a tool schema with safeParse().");
  }

  return schema.safeParse(value) as { success: boolean };
}

export {
  AiqOpenCodeAdapter,
  buildAiqOpenCodeHooks,
  defaultConfig,
  formatAiqOpenCodeResult,
  mkdir,
  mkdtemp,
  os,
  path,
  rm,
  writeFile,
};
