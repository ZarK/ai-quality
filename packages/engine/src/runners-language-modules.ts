import { type Registry, createRegistry } from "./registries.js";
import { basicRunnerLanguageModules } from "./runners-language-modules-basic.js";
import { runtimeRunnerLanguageModules } from "./runners-language-modules-runtime.js";
import type { RunnerLanguageModule, RunnerStageDefinition } from "./runners-stage-types.js";

export function createRunnerLanguageModuleRegistry(
  modules: readonly RunnerLanguageModule[],
): Registry<RunnerLanguageModule> {
  return createRegistry(modules);
}

export function createRunnerStageDefinitionRegistry(
  stageDefinitions: readonly RunnerStageDefinition[],
): Registry<RunnerStageDefinition> {
  return createRegistry(stageDefinitions);
}

export const defaultRunnerLanguageModules = createRunnerLanguageModuleRegistry([
  ...basicRunnerLanguageModules,
  ...runtimeRunnerLanguageModules,
]);
