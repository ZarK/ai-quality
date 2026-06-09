import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, stat, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { runPlannedTask } from "../src/runners.js";

export const fixtureTerraformRoot = path.resolve("test-projects/terraform");
export const fixtureHclRoot = path.resolve("test-projects/hcl");
export const fakeGitHubToken = ["ghp_", "123456789012345678901234567890123456"].join("");
export const hasTerraform = commandAvailable("terraform");
export const tempDirs: string[] = [];

export function commandAvailable(command: string): boolean {
  try {
    execFileSync(process.platform === "win32" ? "where" : "which", [command], {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

export async function createTerraformFixtureProject(
  prefix: string,
): Promise<{ mainFile: string; root: string; variablesFile: string }> {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(workspaceRoot);

  const root = path.join(workspaceRoot, "project");
  await mkdir(root, { recursive: true });
  await cp(fixtureTerraformRoot, root, { recursive: true });

  return {
    mainFile: path.join(root, "main.tf"),
    root,
    variablesFile: path.join(root, "variables.tf"),
  };
}

export async function createHclFixtureProject(
  prefix: string,
): Promise<{ configFile: string; root: string }> {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(workspaceRoot);

  const root = path.join(workspaceRoot, "project");
  await mkdir(root, { recursive: true });
  await cp(fixtureHclRoot, root, { recursive: true });

  return {
    configFile: path.join(root, "config.hcl"),
    root,
  };
}

export async function createTerraformJsonFixtureProject(
  prefix: string,
): Promise<{ root: string; terraformJsonFile: string }> {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(workspaceRoot);

  const root = path.join(workspaceRoot, "project");
  await mkdir(root, { recursive: true });

  const terraformJsonFile = path.join(root, "main.tf.json");
  await writeFile(
    terraformJsonFile,
    `${JSON.stringify({ terraform: { required_version: ">= 1.0.0" } }, null, 2)}\n`,
    "utf8",
  );

  return {
    root,
    terraformJsonFile,
  };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

export { cp, execFileSync, mkdir, mkdtemp, os, path, rm, runPlannedTask, stat, utimes, writeFile };
