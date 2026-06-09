import { execFile } from "node:child_process";
import { access, chmod, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import type { IncomingHttpHeaders } from "node:http";
import os from "node:os";
import path from "node:path";

import { parseAiuTrustedStateJson } from "@tjalve/aiu";
import { afterEach, describe, expect } from "vitest";
import { withExclusiveToolLock } from "../../engine/test/exclusive-tool-lock.js";
import {
  hasDotNet10Toolchain,
  hasPythonQualityToolchain,
} from "../../engine/test/toolchain-capabilities.js";
import type { RunRequest, RunResult } from "../../model/src/index.js";
import { runCli } from "../src/index.js";
import { writeServeListeningOutput } from "../src/output.js";
import { createRunWorkflowOutput } from "../src/workflow.js";

const repoRoot = path.resolve(".");
const npmCommand =
  process.platform === "win32"
    ? {
        argsPrefix: [
          path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"),
        ],
        executable: process.execPath,
      }
    : { argsPrefix: [], executable: "npm" };
const builtCliPath = path.join(repoRoot, "packages", "cli", "dist", "bin", "aiq.js");
const fixtureFile = path.resolve("test-projects/typescript/src/index.ts");
const lintFailureFixtureFile = path.resolve("test-projects/typescript/src/lint-failure.ts");
const fixtureJavaScriptFile = path.resolve("test-projects/javascript/index.js");
const fixtureDotNetRoot = path.resolve("test-projects/dotnet");
const fixturePythonFile = path.resolve("test-projects/python/main.py");
const fixtureTsconfig = path.resolve("test-projects/typescript/tsconfig.json");
const publishedPackageWorkspaces = ["packages/cli"] as const;
const internalPackageWorkspaces = [
  "packages/benchmark",
  "packages/config-schema",
  "packages/engine",
  "packages/github-action",
  "packages/hook",
  "packages/lsp",
  "packages/mcp",
  "packages/model",
  "packages/opencode-plugin",
  "packages/reporters",
] as const;
const adapterPackageWorkspaces = [
  "packages/github-action",
  "packages/hook",
  "packages/lsp",
  "packages/mcp",
  "packages/opencode-plugin",
] as const;
class MemoryOutput {
  value = "";

  write(chunk: string | Uint8Array): boolean {
    this.value += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    return true;
  }
}

class MemoryInput {
  private readonly data: string;

  constructor(data = "") {
    this.data = data;
  }

  on(event: "data", handler: (value: string) => void): this;
  on(event: "end", handler: () => void): this;
  on(event: "error", handler: (error: Error) => void): this;
  on(
    event: string,
    handler: ((value: string) => void) | (() => void) | ((error: Error) => void),
  ): this {
    if (event === "data" && this.data.length > 0) {
      queueMicrotask(() => {
        (handler as (value: string) => void)(this.data);
      });
    }

    if (event === "end") {
      queueMicrotask(() => {
        (handler as () => void)();
      });
    }

    return this;
  }

  resume(): this {
    return this;
  }

  setEncoding(_encoding?: BufferEncoding): this {
    return this;
  }
}

function countOccurrences(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

async function waitFor<T>(
  getValue: () => T | undefined,
  options: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 5_000;
  const intervalMs = options.intervalMs ?? 20;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const value = getValue();
    if (value !== undefined) {
      return value;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, intervalMs);
    });
  }

  throw new Error(`Timed out after ${timeoutMs}ms.`);
}

function parseJsonLines<T>(value: string): T[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as T);
}

type CommandResult = {
  exitCode: number;
  stderr: string;
  stdout: string;
};

type CommandOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
};

function runCommand(
  command: string,
  args: string[],
  options: CommandOptions = {},
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        cwd: options.cwd ?? repoRoot,
        env: {
          ...process.env,
          CI: "true",
          ...options.env,
        },
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error === null) {
          resolve({ exitCode: 0, stderr, stdout });
          return;
        }

        if (typeof error.code === "number") {
          resolve({ exitCode: error.code, stderr, stdout });
          return;
        }

        reject(error);
      },
    );
  });
}

function runNpmCommand(args: string[], options: CommandOptions = {}): Promise<CommandResult> {
  return runCommand(npmCommand.executable, [...npmCommand.argsPrefix, ...args], options);
}

async function createTypeScriptFixtureProject(
  prefix: string,
): Promise<{ filePath: string; root: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(root);

  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(
    path.join(root, "tsconfig.json"),
    await readFile(fixtureTsconfig, "utf8"),
    "utf8",
  );
  const filePath = path.join(root, "src", "index.ts");
  await writeFile(filePath, "export const value = 1;\n", "utf8");

  return { filePath, root };
}

async function initializeGitRepository(root: string): Promise<void> {
  const result = await runCommand("git", ["init"], { cwd: root });
  expect(result.exitCode).toBe(0);
}

async function createDotNetFixtureProject(
  prefix: string,
): Promise<{ filePath: string; root: string }> {
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
    filePath: path.join(root, "src", "DotNetFixture", "Greeter.cs"),
    root,
  };
}

const tempDirs: string[] = [];
const tempArtifacts: string[] = [];

afterEach(async () => {
  await Promise.all([
    ...tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })),
    ...tempArtifacts.splice(0).map((artifact) => rm(artifact, { force: true, recursive: true })),
  ]);
});

export {
  access,
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
  httpRequest,
  os,
  path,
  parseAiuTrustedStateJson,
  withExclusiveToolLock,
  hasDotNet10Toolchain,
  hasPythonQualityToolchain,
  runCli,
  writeServeListeningOutput,
  createRunWorkflowOutput,
  repoRoot,
  npmCommand,
  builtCliPath,
  fixtureFile,
  lintFailureFixtureFile,
  fixtureJavaScriptFile,
  fixtureDotNetRoot,
  fixturePythonFile,
  fixtureTsconfig,
  publishedPackageWorkspaces,
  internalPackageWorkspaces,
  adapterPackageWorkspaces,
  MemoryOutput,
  MemoryInput,
  countOccurrences,
  waitFor,
  parseJsonLines,
  runCommand,
  runNpmCommand,
  createTypeScriptFixtureProject,
  initializeGitRepository,
  createDotNetFixtureProject,
  tempDirs,
  tempArtifacts,
};

export type { CommandOptions, CommandResult, IncomingHttpHeaders, RunRequest, RunResult };
