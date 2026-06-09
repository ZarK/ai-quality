import path from "node:path";

import type { RunStageConfigurations } from "@tjalve/aiq/model";
import { cloneAiqConfig, cloneStageLanguageConfig, cloneSurfaceConfig } from "./clone.js";
import { defaultConfig, resolveProfile } from "./defaults.js";
import { loadAiqConfig } from "./discovery.js";
import type {
  AiqConfig,
  AiqConfigFile,
  AiqLanguageId,
  AiqProfileName,
  AiqStageConfig,
  AiqStageConfigFile,
  AiqStageId,
  AiqSurfaceConfig,
  ResolveAiqConfigOptions,
  ResolvedAiqConfig,
} from "./types.js";
import { aiqLanguageIds, aiqProfileNames, aiqStageIds, aiqSurfaceIds } from "./types.js";

export function mergeAiqConfig(base: AiqConfig, override?: AiqConfigFile): AiqConfig {
  const merged = cloneAiqConfig(base);
  if (override === undefined) {
    return merged;
  }

  mergeInputConfig(merged, override);
  mergeStageConfigs(merged, override);
  mergeProfileConfigs(merged, override);
  mergeSurfaceConfigs(merged, override);

  return merged;
}

function mergeInputConfig(merged: AiqConfig, override: AiqConfigFile): void {
  if (override.inputs?.ignore !== undefined) {
    merged.inputs.ignore = [...override.inputs.ignore];
  }
}

function mergeStageConfigs(merged: AiqConfig, override: AiqConfigFile): void {
  if (override.stages === undefined) {
    return;
  }

  for (const stageId of aiqStageIds) {
    mergeStageConfig(merged, stageId, override.stages[stageId]);
  }
}

function mergeStageConfig(
  merged: AiqConfig,
  stageId: AiqStageId,
  stageOverride: AiqStageConfigFile | undefined,
): void {
  if (stageOverride === undefined) {
    return;
  }

  if (stageOverride.enabled !== undefined) {
    merged.stages[stageId].enabled = stageOverride.enabled;
  }

  mergeStageLanguageConfigs(merged, stageId, stageOverride);
}

function mergeStageLanguageConfigs(
  merged: AiqConfig,
  stageId: AiqStageId,
  stageOverride: AiqStageConfigFile,
): void {
  if (stageOverride.languages === undefined) {
    return;
  }

  for (const languageId of aiqLanguageIds) {
    const languageOverride = stageOverride.languages[languageId];
    if (languageOverride !== undefined) {
      merged.stages[stageId].languages[languageId] = cloneStageLanguageConfig(languageOverride);
    }
  }
}

function mergeProfileConfigs(merged: AiqConfig, override: AiqConfigFile): void {
  if (override.profiles === undefined) {
    return;
  }

  for (const profileName of aiqProfileNames) {
    const profileOverride = override.profiles[profileName];
    if (profileOverride === undefined) {
      continue;
    }

    if (profileOverride.changedOnly !== undefined) {
      merged.profiles[profileName].changedOnly = profileOverride.changedOnly;
    }
    if (profileOverride.stages !== undefined) {
      merged.profiles[profileName].stages = [...profileOverride.stages];
    }
  }
}

function mergeSurfaceConfigs(merged: AiqConfig, override: AiqConfigFile): void {
  if (override.surfaces === undefined) {
    return;
  }

  for (const surfaceId of aiqSurfaceIds) {
    mergeSurfaceConfig(merged, surfaceId, override.surfaces[surfaceId]);
  }
}

function mergeSurfaceConfig(
  merged: AiqConfig,
  surfaceId: keyof AiqConfig["surfaces"],
  surfaceOverride: Partial<AiqSurfaceConfig> | undefined,
): void {
  if (surfaceOverride === undefined) {
    return;
  }

  const surface = cloneSurfaceConfig(merged.surfaces[surfaceId]);
  applySurfaceOverride(surface, surfaceOverride);
  merged.surfaces[surfaceId] = surface;
}

function applySurfaceOverride(
  surface: AiqSurfaceConfig,
  override: Partial<AiqSurfaceConfig>,
): void {
  if (override.cadenceMs !== undefined) {
    surface.cadenceMs = override.cadenceMs;
  }
  if (override.cadenceStages !== undefined) {
    surface.cadenceStages = [...override.cadenceStages];
  }
  if (override.changedOnly !== undefined) {
    surface.changedOnly = override.changedOnly;
  }
  if (override.stages !== undefined) {
    surface.stages = [...override.stages];
  }
  if (override.profile !== undefined) {
    surface.profile = override.profile;
  }
  if (override.publishDiagnostics !== undefined) {
    surface.publishDiagnostics = override.publishDiagnostics;
  }
}

export async function resolveAiqConfig(
  options: ResolveAiqConfigOptions,
): Promise<ResolvedAiqConfig> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const loaded = await loadAiqConfig(cwd);
  const config = mergeAiqConfig(defaultConfig, loaded.config);
  const surfaceConfig = config.surfaces[options.surface];
  const profile = options.profile ?? surfaceConfig.profile;
  const profileConfig = resolveProfile(config, profile);
  const requestedStages = resolveRequestedStages(options, config, surfaceConfig, profileConfig);
  const cadenceStages = uniqueStages(surfaceConfig.cadenceStages ?? []).filter((stageId) =>
    requestedStages.includes(stageId),
  );

  const resolved = createResolvedAiqConfig({
    cadenceStages,
    config,
    cwd,
    loadedPath: loaded.path,
    options,
    profile,
    profileConfig,
    requestedStages,
    surfaceConfig,
  });

  if (loaded.path !== undefined) {
    resolved.configPath = loaded.path;
    resolved.stageConfigurations = resolveStageConfigurations(config, requestedStages);
  }

  return resolved;
}

function resolveRequestedStages(
  options: ResolveAiqConfigOptions,
  config: AiqConfig,
  surfaceConfig: AiqSurfaceConfig,
  profileConfig: ReturnType<typeof resolveProfile>,
): AiqStageId[] {
  if (options.stages !== undefined) {
    return uniqueStages(options.stages);
  }

  return filterEnabledStages(
    config,
    surfaceConfig.stages !== undefined ? surfaceConfig.stages : profileConfig.stages,
  );
}

function createResolvedAiqConfig(args: {
  cadenceStages: AiqStageId[];
  config: AiqConfig;
  cwd: string;
  loadedPath: string | undefined;
  options: ResolveAiqConfigOptions;
  profile: AiqProfileName;
  profileConfig: ReturnType<typeof resolveProfile>;
  requestedStages: AiqStageId[];
  surfaceConfig: AiqSurfaceConfig;
}): ResolvedAiqConfig {
  return {
    ...(args.surfaceConfig.cadenceMs === undefined
      ? {}
      : { cadenceMs: args.surfaceConfig.cadenceMs }),
    cadenceStages: args.cadenceStages,
    changedOnly: args.surfaceConfig.changedOnly ?? args.profileConfig.changedOnly,
    config: args.config,
    cwd: args.cwd,
    stages: args.requestedStages,
    profile: args.profile,
    publishDiagnostics: args.surfaceConfig.publishDiagnostics ?? false,
    source: args.loadedPath === undefined ? "defaults" : "file",
    surface: args.options.surface,
  };
}

function filterEnabledStages(config: AiqConfig, stages: readonly AiqStageId[]): AiqStageId[] {
  const enabled: AiqStageId[] = [];

  for (const stageId of uniqueStages(stages)) {
    if (!config.stages[stageId].enabled) {
      continue;
    }

    enabled.push(stageId);
  }

  return enabled;
}

function resolveStageConfigurations(
  config: AiqConfig,
  stages: readonly AiqStageId[],
): RunStageConfigurations {
  return Object.fromEntries(
    stages.map((stageId) => {
      const languages = Object.fromEntries(
        Object.entries(config.stages[stageId].languages)
          .filter(([, languageConfig]) => languageConfig.enabled)
          .map(([languageId, languageConfig]) => [languageId, { toolId: languageConfig.tool }]),
      );

      return [stageId, { languages }];
    }),
  ) as RunStageConfigurations;
}

function uniqueStages(stages: readonly AiqStageId[]): AiqStageId[] {
  const seen = new Set<AiqStageId>();
  const unique: AiqStageId[] = [];

  for (const stageId of stages) {
    if (seen.has(stageId)) {
      continue;
    }

    seen.add(stageId);
    unique.push(stageId);
  }

  return unique;
}
