import { execFileSync } from "node:child_process";
import { chmod, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";
import { runEngine as runEngineBase } from "../src/index.js";
import { buildEngineContext } from "../src/request.js";
import { runPlannedTask as runPlannedTaskBase } from "../src/runners.js";
import { ToolRunner } from "../src/tool-runner.js";
import * as binaries from "../src/tools/binary-resolver.js";
import { withExclusiveToolLock } from "./exclusive-tool-lock.js";
import {
  hasDotNet10Toolchain,
  hasGoToolchain,
  hasGradleToolchain,
  hasMavenToolchain,
  hasPowerShellPesterToolchain,
  hasPythonQualityToolchain,
  hasRustCoverageToolchain,
  hasRustToolchain,
} from "./toolchain-capabilities.js";

export const fixtureFile = path.resolve("test-projects/typescript/src/index.ts");
export const lintFailureFixtureFile = path.resolve("test-projects/typescript/src/lint-failure.ts");
export const fixtureJavaScriptFile = path.resolve("test-projects/javascript/index.js");
export const fixtureBashRoot = path.resolve("test-projects/bash");
export const fixtureDotNetRoot = path.resolve("test-projects/dotnet");
export const fixtureGoRoot = path.resolve("test-projects/go");
export const fixtureJavaMavenRoot = path.resolve("test-projects/java-maven");
export const fixtureKotlinGradleRoot = path.resolve("test-projects/kotlin-gradle");
export const fixturePowerShellRoot = path.resolve("test-projects/powershell");
export const fixturePythonConfigFile = path.resolve("test-projects/python/pyproject.toml");
export const fixturePythonFile = path.resolve("test-projects/python/main.py");
export const fixtureRustRoot = path.resolve("test-projects/rust");
export const fixtureTypeScriptPackageJson = path.resolve("test-projects/typescript/package.json");
export const fixtureTsconfig = path.resolve("test-projects/typescript/tsconfig.json");
export const vitestCliPath = path.resolve("node_modules/vitest/vitest.mjs");
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

export async function createDotNetFixtureProject(
  prefix: string,
): Promise<{ root: string; solutionFile: string; sourceFile: string; testFile: string }> {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(workspaceRoot);

  const root = path.join(workspaceRoot, "project");
  await cp(fixtureDotNetRoot, root, { recursive: true });
  await Promise.all([
    rm(path.join(root, "src", "DotNetFixture", "bin"), { force: true, recursive: true }),
    rm(path.join(root, "src", "DotNetFixture", "obj"), { force: true, recursive: true }),
    rm(path.join(root, "tests", "DotNetFixture.Tests", "bin"), {
      force: true,
      recursive: true,
    }),
    rm(path.join(root, "tests", "DotNetFixture.Tests", "obj"), {
      force: true,
      recursive: true,
    }),
  ]);

  return {
    root,
    solutionFile: path.join(root, "DotNetFixture.slnx"),
    sourceFile: path.join(root, "src", "DotNetFixture", "Greeter.cs"),
    testFile: path.join(root, "tests", "DotNetFixture.Tests", "GreeterTests.cs"),
  };
}

export async function createJavaMavenFixtureProject(
  prefix: string,
): Promise<{ buildFile: string; root: string; sourceFile: string; testFile: string }> {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(workspaceRoot);

  const root = path.join(workspaceRoot, "project");
  await cp(fixtureJavaMavenRoot, root, { recursive: true });

  return {
    buildFile: path.join(root, "pom.xml"),
    root,
    sourceFile: path.join(root, "src", "main", "java", "dev", "aiq", "fixture", "Greeting.java"),
    testFile: path.join(root, "src", "test", "java", "dev", "aiq", "fixture", "GreetingTest.java"),
  };
}

export async function createKotlinGradleFixtureProject(
  prefix: string,
): Promise<{ buildFile: string; root: string; sourceFile: string; testFile: string }> {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(workspaceRoot);

  const root = path.join(workspaceRoot, "project");
  await cp(fixtureKotlinGradleRoot, root, { recursive: true });

  return {
    buildFile: path.join(root, "build.gradle.kts"),
    root,
    sourceFile: path.join(root, "src", "main", "kotlin", "dev", "aiq", "fixture", "Greeting.kt"),
    testFile: path.join(root, "src", "test", "kotlin", "dev", "aiq", "fixture", "GreetingTest.kt"),
  };
}

export async function createGoFixtureProject(
  prefix: string,
): Promise<{ moduleFile: string; root: string; sourceFile: string; testFile: string }> {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(workspaceRoot);

  const root = path.join(workspaceRoot, "project");
  await cp(fixtureGoRoot, root, { recursive: true });

  return {
    moduleFile: path.join(root, "go.mod"),
    root,
    sourceFile: path.join(root, "greeter.go"),
    testFile: path.join(root, "greeter_test.go"),
  };
}

export async function createRustFixtureProject(
  prefix: string,
): Promise<{ manifestFile: string; root: string; sourceFile: string; testFile: string }> {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(workspaceRoot);

  const root = path.join(workspaceRoot, "project");
  await cp(fixtureRustRoot, root, { recursive: true });

  return {
    manifestFile: path.join(root, "Cargo.toml"),
    root,
    sourceFile: path.join(root, "src", "lib.rs"),
    testFile: path.join(root, "tests", "integration.rs"),
  };
}

export async function createBashFixtureProject(
  prefix: string,
): Promise<{ root: string; sourceFile: string; testFile: string }> {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(workspaceRoot);

  const root = path.join(workspaceRoot, "project");
  await cp(fixtureBashRoot, root, { recursive: true });

  return {
    root,
    sourceFile: path.join(root, "example.sh"),
    testFile: path.join(root, "example_test.bats"),
  };
}

export async function createPowerShellFixtureProject(
  prefix: string,
): Promise<{ root: string; sourceFile: string; testFile: string }> {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(workspaceRoot);

  const root = path.join(workspaceRoot, "project");
  await cp(fixturePowerShellRoot, root, { recursive: true });

  return {
    root,
    sourceFile: path.join(root, "utils.ps1"),
    testFile: path.join(root, "utils.tests.ps1"),
  };
}

export function resolveCommandPath(command: string): string {
  return execFileSync("sh", ["-lc", `command -v ${command}`], { encoding: "utf8" }).trim();
}

export async function withExclusiveDotNet<T>(run: () => Promise<T>): Promise<T> {
  return withExclusiveToolLock("dotnet", run);
}

export async function withExclusiveRust<T>(run: () => Promise<T>): Promise<T> {
  return withExclusiveToolLock("rust", run);
}

export function runEngine(
  request: Parameters<typeof runEngineBase>[0],
): ReturnType<typeof runEngineBase> {
  const run = () => runEngineBase(request);
  return shouldUseGradleLock(request.manifest.files, request.stages)
    ? (withExclusiveToolLock("gradle", run) as ReturnType<typeof runEngineBase>)
    : run();
}

export function runPlannedTask(
  task: Parameters<typeof runPlannedTaskBase>[0],
  cwd: Parameters<typeof runPlannedTaskBase>[1],
): ReturnType<typeof runPlannedTaskBase> {
  const run = () => runPlannedTaskBase(task, cwd);
  return shouldUseGradleLock(task.files, [task.stageId])
    ? (withExclusiveToolLock("gradle", run) as ReturnType<typeof runPlannedTaskBase>)
    : run();
}

const gradleLockStageIds = new Set(["coverage", "format", "lint", "typecheck", "unit"]);

function shouldUseGradleLock(files: readonly string[], stages: readonly string[]): boolean {
  return (
    stages.some((stage) => gradleLockStageIds.has(stage)) &&
    files.some((file) => {
      const baseName = path.basename(file).toLowerCase();
      return (
        file.endsWith(".kt") ||
        baseName === "build.gradle" ||
        baseName === "build.gradle.kts" ||
        baseName === "settings.gradle" ||
        baseName === "settings.gradle.kts"
      );
    })
  );
}

export async function resolvePowerShellModuleAvailable(moduleName: string): Promise<boolean> {
  const toolRunner = new ToolRunner();
  return (await toolRunner.resolvePowerShellModuleManifest(moduleName)) !== undefined;
}

export function withToolRunnerOverride<T extends Awaited<ReturnType<typeof buildEngineContext>>>(
  context: T,
  toolRunner: ToolRunner,
): T & { toolRunner: ToolRunner } {
  return {
    ...context,
    toolRunner,
  };
}

export {
  ToolRunner,
  binaries,
  buildEngineContext,
  chmod,
  cp,
  execFileSync,
  hasDotNet10Toolchain,
  hasGoToolchain,
  hasGradleToolchain,
  hasMavenToolchain,
  hasPowerShellPesterToolchain,
  hasPythonQualityToolchain,
  hasRustCoverageToolchain,
  hasRustToolchain,
  mkdir,
  mkdtemp,
  os,
  path,
  readFile,
  readdir,
  rm,
  withExclusiveToolLock,
  writeFile,
};
