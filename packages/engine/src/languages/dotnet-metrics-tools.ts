import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

import * as commands from "../tools/command-builders.js";
import { pathExists } from "../utils/path-utils.js";
import type { DotNetRunnerRuntime } from "./contracts.js";
import { readDotNetFileMetrics } from "./dotnet-source-metrics.js";
import type { DotNetProject } from "./dotnet.js";

export type DotNetMetricsFileMetrics = {
  blockCount: number;
  maintainability: { rank: string; score: number };
  maxComplexity: { rank: string; score: number };
  raw: { sloc: number };
};

export type DotNetMetricsProjectMetrics = {
  args: string[];
  durationMs: number;
  exitCode: number | undefined;
  files: Record<string, DotNetMetricsFileMetrics>;
  finishedAt: string;
  startedAt: string;
};

export async function getDotNetMetricsProjectMetrics(
  project: DotNetProject,
  runtime: DotNetRunnerRuntime,
): Promise<{ cacheHit: boolean; metrics: DotNetMetricsProjectMetrics }> {
  const manifestKey = createDotNetMetricsManifestKey(project);
  const cacheKey = await createDotNetMetricsCacheKey(project, manifestKey);
  const cached = await runtime.getCachedValue("metrics:dotnet", manifestKey, cacheKey, () =>
    runDotNetMetricsProjectTask(project, runtime),
  );

  return {
    cacheHit: cached.cacheHit,
    metrics: cached.value,
  };
}

function createDotNetMetricsManifestKey(project: DotNetProject): string {
  return `${project.targetPath}:${[...project.files].sort().join("|")}`;
}

async function createDotNetMetricsCacheKey(
  project: DotNetProject,
  manifestKey = createDotNetMetricsManifestKey(project),
): Promise<string> {
  const fileEntries = await Promise.all(
    [...project.files]
      .sort((left, right) => left.localeCompare(right))
      .map(async (file) => {
        const fileStats = await stat(file);
        return `${file}@${fileStats.size}:${fileStats.mtimeMs}`;
      }),
  );

  return `${manifestKey}:${fileEntries.join("|")}`;
}

async function runDotNetMetricsProjectTask(
  project: DotNetProject,
  runtime: DotNetRunnerRuntime,
): Promise<DotNetMetricsProjectMetrics> {
  if (runtime.signal?.aborted) {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    runtime.throwIfAbortError(abortError);
  }

  const startedAt = new Date();
  const files = await Promise.all(
    project.files.map(
      async (file) =>
        [file, await readDotNetFileMetrics(await runtime.readFileText(file))] as const,
    ),
  );
  const finishedAt = new Date();

  return {
    args: ["scan", ...project.files],
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    exitCode: 0,
    files: Object.fromEntries(files),
    finishedAt: finishedAt.toISOString(),
    startedAt: startedAt.toISOString(),
  };
}

export async function readJsonValue(filePath: string): Promise<unknown> {
  if (!(await pathExists(filePath))) {
    return undefined;
  }

  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch {
    return undefined;
  }
}

export async function readOptionalTextFile(
  filePath: string | undefined,
): Promise<string | undefined> {
  if (filePath === undefined || !(await pathExists(filePath))) {
    return undefined;
  }

  return readFile(filePath, "utf8");
}

export async function findFirstFile(
  directory: string,
  predicate: (filePath: string) => boolean,
): Promise<string | undefined> {
  if (!(await pathExists(directory))) {
    return undefined;
  }

  const entries = (await readdir(directory, { withFileTypes: true })).sort((left, right) =>
    left.name.localeCompare(right.name),
  );

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await findFirstFile(entryPath, predicate);
      if (nested !== undefined) {
        return nested;
      }
      continue;
    }

    if (entry.isFile() && predicate(entryPath)) {
      return entryPath;
    }
  }

  return undefined;
}
