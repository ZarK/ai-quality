import { cp, mkdtemp, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

import { formatError } from "./errors.js";
import type { BenchmarkScenario } from "./types.js";

const ignoredWorkspaceDirectories = new Set([
  ".aiq",
  ".git",
  ".gradle",
  ".idea",
  ".mypy_cache",
  ".terraform",
  ".pytest_cache",
  ".ruff_cache",
  ".venv",
  "__pycache__",
  "bin",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "obj",
  "target",
  "venv",
]);

export interface BenchmarkWorkspace {
  root: string;
  tempRoot: string;
}

export async function createScenarioWorkspace(
  fixturePath: string,
  scenarioId: string,
): Promise<BenchmarkWorkspace> {
  const parentDir = path.resolve(fixturePath, "..");
  const tempRoot = await mkdtemp(path.join(parentDir, `.aiq-benchmark-${scenarioId}-`));
  const workspaceRoot = path.join(tempRoot, "workspace");
  await cp(fixturePath, workspaceRoot, {
    filter: (source) => shouldCopyWorkspaceEntry(source),
    recursive: true,
  });
  return {
    root: workspaceRoot,
    tempRoot,
  };
}

function shouldCopyWorkspaceEntry(source: string): boolean {
  return !path
    .normalize(source)
    .split(path.sep)
    .some((segment) => ignoredWorkspaceDirectories.has(segment));
}

export interface ResolvedScenarioManifest {
  absoluteFiles: string[];
  loc: number;
  relativeFiles: string[];
}

export async function resolveScenarioManifest(
  scenario: BenchmarkScenario,
  workspaceRoot: string,
): Promise<ResolvedScenarioManifest> {
  const discoveredFiles = new Set<string>();

  for (const input of scenario.inputs) {
    const inputPath = path.resolve(workspaceRoot, input);
    const inputStats = await stat(inputPath).catch((error: unknown) => {
      throw new Error(
        `Input '${input}' does not exist in benchmark fixture: ${formatError(error)}`,
      );
    });

    if (inputStats.isDirectory()) {
      for (const file of await walkScenarioDirectory(inputPath)) {
        discoveredFiles.add(file);
      }
      continue;
    }

    if (!inputStats.isFile()) {
      throw new Error(`Input '${input}' is not a regular file or directory.`);
    }

    discoveredFiles.add(inputPath);
  }

  const absoluteFiles = [...discoveredFiles].sort((left, right) => left.localeCompare(right));
  if (absoluteFiles.length === 0) {
    throw new Error(`Scenario '${scenario.id}' resolved no files from the configured inputs.`);
  }

  const locByFile = await Promise.all(
    absoluteFiles.map(async (file) => ({
      file,
      loc: countLines(await readFile(file, "utf8")),
    })),
  );

  return {
    absoluteFiles,
    loc: locByFile.reduce((total, entry) => total + entry.loc, 0),
    relativeFiles: absoluteFiles.map((file) => toPortableRelativePath(workspaceRoot, file)),
  };
}

async function walkScenarioDirectory(root: string): Promise<string[]> {
  const discoveredFiles: string[] = [];
  const queue = [root];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) {
      continue;
    }

    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredWorkspaceDirectories.has(entry.name)) {
          queue.push(entryPath);
        }
        continue;
      }

      if (entry.isFile()) {
        discoveredFiles.push(entryPath);
      }
    }
  }

  return discoveredFiles;
}

function countLines(source: string): number {
  const normalized = source.replace(/\r\n/gu, "\n");
  if (normalized.length === 0) {
    return 0;
  }

  const lines = normalized.split("\n");
  return lines.at(-1) === "" ? lines.length - 1 : lines.length;
}

function toPortableRelativePath(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join(path.posix.sep);
}

export function resolveScenarioOutDir(baseOutDir: string, scenarioId: string): string {
  if (isInvalidScenarioId(scenarioId)) {
    throw new Error(
      `Invalid benchmark scenario id '${scenarioId}'. Scenario ids must not be empty or contain path separators.`,
    );
  }

  const resolvedBaseOutDir = path.resolve(baseOutDir);
  const scenarioOutDir = path.resolve(resolvedBaseOutDir, scenarioId);
  const relativeScenarioOutDir = path.relative(resolvedBaseOutDir, scenarioOutDir);
  if (isUnsafeRelativeScenarioOutDir(relativeScenarioOutDir)) {
    throw new Error(`Invalid benchmark scenario id '${scenarioId}'.`);
  }

  return scenarioOutDir;
}

function isInvalidScenarioId(scenarioId: string): boolean {
  return (
    scenarioId.trim().length === 0 ||
    scenarioId === "." ||
    scenarioId === ".." ||
    scenarioId.includes(path.posix.sep) ||
    scenarioId.includes(path.win32.sep)
  );
}

function isUnsafeRelativeScenarioOutDir(relativeScenarioOutDir: string): boolean {
  return (
    relativeScenarioOutDir.length === 0 ||
    relativeScenarioOutDir === "." ||
    relativeScenarioOutDir === ".." ||
    relativeScenarioOutDir.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeScenarioOutDir)
  );
}
