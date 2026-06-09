import type {
  AiqConfig,
  AiqLanguageId,
  AiqProfileConfig,
  AiqProfileName,
  AiqProgressState,
  AiqStageConfig,
  AiqStageId,
  AiqStageLanguageConfig,
  AiqSurfaceConfig,
  AiqSurfaceId,
} from "./types.js";
import { aiqProfileNames, aiqStageIds, aiqSurfaceIds } from "./types.js";

export function cloneAiqConfig(config: AiqConfig): AiqConfig {
  return {
    version: 1,
    inputs: {
      ignore: [...config.inputs.ignore],
    },
    stages: Object.fromEntries(
      aiqStageIds.map((stageId) => [stageId, cloneStageConfig(config.stages[stageId])]),
    ) as Record<AiqStageId, AiqStageConfig>,
    profiles: Object.fromEntries(
      aiqProfileNames.map((profileName) => [
        profileName,
        cloneProfileConfig(config.profiles[profileName]),
      ]),
    ) as Record<AiqProfileName, AiqProfileConfig>,
    surfaces: Object.fromEntries(
      aiqSurfaceIds.map((surfaceId) => [surfaceId, cloneSurfaceConfig(config.surfaces[surfaceId])]),
    ) as Record<AiqSurfaceId, AiqSurfaceConfig>,
  };
}

export function cloneStageConfig(config: AiqStageConfig): AiqStageConfig {
  return {
    enabled: config.enabled,
    languages: cloneStageLanguages(config.languages),
  };
}

export function cloneStageLanguages(
  languages: Partial<Record<AiqLanguageId, AiqStageLanguageConfig>>,
): Partial<Record<AiqLanguageId, AiqStageLanguageConfig>> {
  return Object.fromEntries(
    Object.entries(languages).flatMap(([languageId, languageConfig]) =>
      languageConfig === undefined ? [] : [[languageId, cloneStageLanguageConfig(languageConfig)]],
    ),
  ) as Partial<Record<AiqLanguageId, AiqStageLanguageConfig>>;
}

export function cloneStageLanguageConfig(config: AiqStageLanguageConfig): AiqStageLanguageConfig {
  return {
    enabled: config.enabled,
    tool: config.tool,
  };
}

export function cloneProfileConfig(config: AiqProfileConfig): AiqProfileConfig {
  return {
    changedOnly: config.changedOnly,
    stages: [...config.stages],
  };
}

export function cloneSurfaceConfig(config: AiqSurfaceConfig): AiqSurfaceConfig {
  const cloned: AiqSurfaceConfig = {
    profile: config.profile,
  };

  if (config.cadenceMs !== undefined) {
    cloned.cadenceMs = config.cadenceMs;
  }

  if (config.cadenceStages !== undefined) {
    cloned.cadenceStages = [...config.cadenceStages];
  }

  if (config.changedOnly !== undefined) {
    cloned.changedOnly = config.changedOnly;
  }

  if (config.stages !== undefined) {
    cloned.stages = [...config.stages];
  }

  if (config.publishDiagnostics !== undefined) {
    cloned.publishDiagnostics = config.publishDiagnostics;
  }

  return cloned;
}

export function cloneProgressState(progress: AiqProgressState): AiqProgressState {
  return {
    current_stage: progress.current_stage,
    disabled: [...progress.disabled],
    order: [...progress.order],
    last_run: progress.last_run,
  };
}
