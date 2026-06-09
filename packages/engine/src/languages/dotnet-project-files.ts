import { readdir } from "node:fs/promises";
import path from "node:path";

import { resolveProjectConcurrencyLimit } from "../runtime-tunables.js";
import { pathExists } from "../utils/path-utils.js";
import type { DotNetProject } from "./dotnet-projects.js";
import {
  dotNetExtensions,
  dotNetProjectExtensions,
  dotNetSourceExtensions,
  readDirectoryEntries,
  readDotNetSolutionProjectPaths,
} from "./dotnet-projects.js";

export async function resolveDotNetMetricsFiles(project: DotNetProject): Promise<string[]> {
  const selectedSourceFiles = project.files.filter((file) =>
    dotNetSourceExtensions.has(path.extname(file).toLowerCase()),
  );
  if (selectedSourceFiles.length > 0) {
    return [...new Set(selectedSourceFiles)].sort((left, right) => left.localeCompare(right));
  }

  const targetExtension = path.extname(project.targetPath).toLowerCase();
  if (targetExtension === ".sln" || targetExtension === ".slnx") {
    const solutionProjectPaths = await readDotNetSolutionProjectPaths(project.targetPath);
    const projectFiles = await Promise.all(
      solutionProjectPaths.map(async (solutionProjectPath) =>
        resolveDotNetProjectSourceFiles(solutionProjectPath),
      ),
    );
    return [...new Set(projectFiles.flat())].sort((left, right) => left.localeCompare(right));
  }

  return resolveDotNetProjectSourceFiles(project.targetPath);
}

export async function resolveDotNetProjectSourceFiles(projectPath: string): Promise<string[]> {
  const projectRoot = path.dirname(projectPath);
  const nestedProjectRoots = await findDotNetNestedProjectRoots(projectPath);
  return findMatchingFiles(
    projectRoot,
    (filePath) => {
      const extension = path.extname(filePath).toLowerCase();
      if (!dotNetSourceExtensions.has(extension)) {
        return false;
      }

      const relativePath = path.relative(projectRoot, filePath);
      const segments = relativePath.split(path.sep).map((segment) => segment.toLowerCase());
      return !segments.includes("bin") && !segments.includes("obj");
    },
    (directoryPath) => nestedProjectRoots.has(path.resolve(directoryPath)),
  );
}

export async function findDotNetNestedProjectRoots(projectPath: string): Promise<Set<string>> {
  const normalizedProjectPath = path.resolve(projectPath);
  const projectRoot = path.dirname(normalizedProjectPath);
  const nestedProjectPaths = await findMatchingFiles(projectRoot, (filePath) => {
    const extension = path.extname(filePath).toLowerCase();
    return extension === ".csproj" && path.resolve(filePath) !== normalizedProjectPath;
  });

  return new Set(nestedProjectPaths.map((nestedProjectPath) => path.dirname(nestedProjectPath)));
}

export function filterDotNetFiles(files: readonly string[]): string[] {
  return files.filter((file) => dotNetExtensions.has(path.extname(file).toLowerCase()));
}

export async function findMatchingFiles(
  directory: string,
  predicate: (filePath: string) => boolean,
  shouldSkipDirectory?: (directoryPath: string) => boolean,
): Promise<string[]> {
  if (!(await pathExists(directory))) {
    return [];
  }

  const entries = await readDirectoryEntries(directory);
  if (entries === undefined) {
    return [];
  }

  const sortedEntries = [...entries].sort((left, right) => left.name.localeCompare(right.name));
  const matches: string[] = [];

  for (const entry of sortedEntries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (shouldSkipDirectory?.(entryPath) === true) {
        continue;
      }
      matches.push(...(await findMatchingFiles(entryPath, predicate, shouldSkipDirectory)));
      continue;
    }

    if (entry.isFile() && predicate(entryPath)) {
      matches.push(entryPath);
    }
  }

  return matches;
}

export async function runProjectBatches<TProject, TResult>(
  projects: readonly TProject[],
  runProject: (project: TProject) => Promise<TResult>,
  concurrencyLimit = resolveProjectConcurrencyLimit(),
): Promise<TResult[]> {
  const results: TResult[] = [];

  for (let index = 0; index < projects.length; index += concurrencyLimit) {
    const projectBatch = projects.slice(index, index + concurrencyLimit);
    results.push(...(await Promise.all(projectBatch.map((project) => runProject(project)))));
  }

  return results;
}
