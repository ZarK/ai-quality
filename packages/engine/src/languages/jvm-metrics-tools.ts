import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import * as parsers from "../parsers/index.js";
import type { LizardMetricsFileMetrics } from "../parsers/lizard.js";
import * as commands from "../tools/command-builders.js";
import type { JvmRunnerRuntime } from "./contracts.js";
import { type JvmProject, jvmSourceExtensions } from "./jvm.js";

export type JvmMetricsFileMetrics = LizardMetricsFileMetrics;

export type JvmMetricsProjectMetrics = {
  args: string[];
  durationMs: number;
  exitCode: number | undefined;
  files: Record<string, JvmMetricsFileMetrics>;
  finishedAt: string;
  startedAt: string;
};

export async function resolveJvmMetricsFiles(
  project: JvmProject,
  runtime: JvmRunnerRuntime,
): Promise<string[]> {
  const selectedSourceFiles = project.files.filter((file) =>
    jvmSourceExtensions.has(path.extname(file).toLowerCase()),
  );
  if (selectedSourceFiles.length > 0) {
    return [...new Set(selectedSourceFiles)].sort((left, right) => left.localeCompare(right));
  }

  return runtime.findMatchingFiles(
    project.projectRoot,
    (filePath) => jvmSourceExtensions.has(path.extname(filePath).toLowerCase()),
    (directoryPath) => {
      const name = path.basename(directoryPath).toLowerCase();
      return name === ".gradle" || name === "build" || name === "out" || name === "target";
    },
  );
}

export async function getJvmMetricsProjectMetrics(
  project: JvmProject & { files: string[] },
  runtime: JvmRunnerRuntime,
): Promise<{ cacheHit: boolean; metrics: JvmMetricsProjectMetrics }> {
  const manifestKey = createJvmMetricsManifestKey(project);
  const cacheKey = await createJvmMetricsCacheKey(project, manifestKey);
  const cached = await runtime.getCachedValue("metrics:jvm", manifestKey, cacheKey, () =>
    runJvmMetricsProjectTask(project, runtime),
  );

  return {
    cacheHit: cached.cacheHit,
    metrics: cached.value,
  };
}

function createJvmMetricsManifestKey(project: { buildFilePath: string; files: string[] }): string {
  return `${project.buildFilePath}:${[...project.files].sort().join("|")}`;
}

async function createJvmMetricsCacheKey(
  project: { buildFilePath: string; files: string[] },
  manifestKey = createJvmMetricsManifestKey(project),
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

async function runJvmMetricsProjectTask(
  project: JvmProject & { files: string[] },
  runtime: JvmRunnerRuntime,
): Promise<JvmMetricsProjectMetrics> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "aiq-jvm-metrics-"));

  try {
    const inputFile = path.join(tempDir, "files.txt");
    await writeFile(inputFile, `${project.files.join("\n")}\n`, "utf8");
    const args = commands.createLizardArgs({ inputFile, languages: ["java", "kotlin"] });
    const outcome = await runtime.runExecutable(
      runtime.resolveUvxCommand(),
      args,
      project.projectRoot,
      runtime.signal,
    );
    if (outcome.exitCode !== 0) {
      throw new Error(
        runtime.readProcessFailureMessage(
          "lizard",
          outcome.stderr,
          outcome.stdout,
          outcome.exitCode,
        ),
      );
    }

    return {
      args,
      durationMs: outcome.durationMs,
      exitCode: outcome.exitCode,
      files: await parsers.parseLizardMetrics(outcome.stdout, project.projectRoot, project.files),
      finishedAt: outcome.finishedAt,
      startedAt: outcome.startedAt,
    };
  } finally {
    await rm(tempDir, { force: true, recursive: true }).catch(() => undefined);
  }
}
