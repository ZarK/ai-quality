import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { cloneProgressState } from "./clone.js";
import { defaultConfig, defaultProgressState } from "./defaults.js";
import { formatError } from "./errors.js";
import type {
  AiqConfigFile,
  AiqProgressStageIndex,
  AiqProgressState,
  InitializedAiqProjectConfig,
  LoadedAiqConfig,
  LoadedAiqProgress,
} from "./types.js";
import { aiqConfigFileNames, aiqProgressFileName } from "./types.js";
import { validateAiqConfigFile, validateAiqProgressState } from "./validation.js";

export async function findAiqConfigFile(startDir: string): Promise<string | undefined> {
  let currentDir = path.resolve(startDir);

  while (true) {
    for (const relativePath of aiqConfigFileNames) {
      const candidate = path.join(currentDir, relativePath);
      if (await pathExists(candidate)) {
        return candidate;
      }
    }

    const nextDir = path.dirname(currentDir);
    if (nextDir === currentDir) {
      return undefined;
    }

    currentDir = nextDir;
  }
}

export async function findAiqProgressFile(startDir: string): Promise<string | undefined> {
  let currentDir = path.resolve(startDir);

  while (true) {
    const candidate = path.join(currentDir, aiqProgressFileName);
    if (await pathExists(candidate)) {
      return candidate;
    }

    const nextDir = path.dirname(currentDir);
    if (nextDir === currentDir) {
      return undefined;
    }

    currentDir = nextDir;
  }
}

export async function findAiqProjectRoot(startDir: string): Promise<string> {
  const progressPath = await findAiqProgressFile(startDir);
  if (progressPath !== undefined) {
    return path.dirname(path.dirname(progressPath));
  }

  const configPath = await findAiqConfigFile(startDir);
  if (configPath !== undefined) {
    const configDir = path.dirname(configPath);
    return path.basename(configDir) === ".aiq" ? path.dirname(configDir) : configDir;
  }

  return path.resolve(startDir);
}

export async function loadAiqConfig(cwd: string): Promise<LoadedAiqConfig> {
  const configPath = await findAiqConfigFile(cwd);
  if (configPath === undefined) {
    return {};
  }

  let rawValue: unknown;
  try {
    rawValue = JSON.parse(await readFile(configPath, "utf8"));
  } catch (error) {
    throw new Error(`Failed to parse ${configPath}: ${formatError(error)}`);
  }

  return {
    config: validateAiqConfigFile(rawValue, configPath),
    path: configPath,
  };
}

export async function loadAiqProgress(cwd: string): Promise<LoadedAiqProgress> {
  const progressPath = await findAiqProgressFile(cwd);
  if (progressPath === undefined) {
    const projectRoot = await findAiqProjectRoot(cwd);
    return {
      path: path.join(projectRoot, aiqProgressFileName),
      progress: cloneProgressState(defaultProgressState),
      source: "defaults",
    };
  }

  let rawValue: unknown;
  try {
    rawValue = JSON.parse(await readFile(progressPath, "utf8"));
  } catch (error) {
    throw new Error(`Failed to parse ${progressPath}: ${formatError(error)}`);
  }

  return {
    path: progressPath,
    progress: validateAiqProgressState(rawValue, progressPath),
    source: "file",
  };
}

export async function saveAiqProgress(
  progressPath: string,
  progress: AiqProgressState,
): Promise<void> {
  await mkdir(path.dirname(progressPath), { recursive: true });
  await writeJsonFile(progressPath, validateAiqProgressState(progress, progressPath));
}

export async function setAiqProgressStage(
  cwd: string,
  stageIndex: AiqProgressStageIndex,
): Promise<LoadedAiqProgress> {
  const loaded = await loadAiqProgress(cwd);
  const progress: AiqProgressState = {
    ...loaded.progress,
    current_stage: stageIndex,
  };
  await saveAiqProgress(loaded.path, progress);
  return {
    path: loaded.path,
    progress,
    source: "file",
  };
}

export async function initializeAiqProjectConfig(
  cwd: string,
): Promise<InitializedAiqProjectConfig> {
  const projectRoot = await findAiqProjectRoot(cwd);
  const existingConfigPath = await findAiqConfigFile(cwd);
  const existingProgressPath = await findAiqProgressFile(cwd);
  const configPath = existingConfigPath ?? path.join(projectRoot, aiqConfigFileNames[0]);
  const progressPath = existingProgressPath ?? path.join(projectRoot, aiqProgressFileName);

  if (existingConfigPath === undefined) {
    await mkdir(path.dirname(configPath), { recursive: true });
    await writeJsonFile(configPath, { version: 1 });
  } else {
    await loadAiqConfig(cwd);
  }

  if (existingProgressPath === undefined) {
    await saveAiqProgress(progressPath, defaultProgressState);
  } else {
    await loadAiqProgress(cwd);
  }

  return {
    configCreated: existingConfigPath === undefined,
    configPath,
    progressCreated: existingProgressPath === undefined,
    progressPath,
  };
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
