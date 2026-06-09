import path from "node:path";

import type {
  LanguageId,
  PlannedTask,
  RunStageConfiguration,
  StageId,
  StageResult,
} from "./contracts.js";
import { isJvmTaskFile as isJvmLanguageTaskFile } from "./languages/jvm.js";
import { isHclFile, isTerraformFile } from "./languages/terraform.js";
import type { Registry } from "./registries.js";
import { getRunnerStageConfigurations } from "./runners-context.js";
import {
  bashExtensions,
  bashTestExtensions,
  cssExtensions,
  dotNetExtensions,
  goProjectConfigNames,
  goSourceExtensions,
  htmlExtensions,
  isGoTaskFile,
  isJavaScriptMetricsTaskFile,
  isPythonTaskFile,
  isRustTaskFile,
  javaScriptExtensions,
  javaScriptProjectConfigNames,
  javaSourceExtensions,
  jvmTaskConfigNames,
  kotlinSourceExtensions,
  powerShellExtensions,
  prettierDocumentExtensions,
  rustProjectConfigNames,
  rustSourceExtensions,
  sharedBiomeExtensions,
  sqlExtensions,
  typeScriptExtensions,
  yamlExtensions,
} from "./runners-file-types.js";
import {
  createRunnerStageDefinitionRegistry,
  defaultRunnerLanguageModules,
} from "./runners-language-modules.js";
import { combineStageResults, createNotImplementedStageResult } from "./runners-results.js";
import type {
  RunnerLanguageModule,
  RunnerResolvedStageHandler,
  RunnerStageDefinition,
} from "./runners-stage-types.js";

type LanguageFileContext = {
  baseName: string;
  extension: string;
  file: string;
  lowerBaseName: string;
};

const languageFileMatchers: {
  [K in LanguageId]?: (context: LanguageFileContext) => boolean;
} = {
  bash: ({ extension }) => bashExtensions.has(extension) || bashTestExtensions.has(extension),
  css: ({ extension }) => cssExtensions.has(extension),
  documents: ({ extension }) => prettierDocumentExtensions.has(extension),
  dotnet: ({ extension }) => dotNetExtensions.has(extension),
  go: ({ extension, lowerBaseName }) =>
    goSourceExtensions.has(extension) || goProjectConfigNames.includes(lowerBaseName),
  hcl: ({ file }) => isHclFile(file),
  html: ({ extension }) => htmlExtensions.has(extension),
  java: ({ extension, lowerBaseName }) =>
    javaSourceExtensions.has(extension) || jvmTaskConfigNames.includes(lowerBaseName),
  javascript: ({ extension, lowerBaseName }) =>
    javaScriptExtensions.has(extension) || javaScriptProjectConfigNames.includes(lowerBaseName),
  kotlin: ({ extension, lowerBaseName }) =>
    kotlinSourceExtensions.has(extension) || jvmTaskConfigNames.includes(lowerBaseName),
  powershell: ({ extension }) => powerShellExtensions.has(extension),
  python: ({ file }) => isPythonTaskFile(file),
  rust: ({ baseName, extension }) =>
    rustSourceExtensions.has(extension) || rustProjectConfigNames.includes(baseName),
  sql: ({ extension }) => sqlExtensions.has(extension),
  terraform: ({ file }) => isTerraformFile(file),
  typescript: ({ extension, lowerBaseName }) =>
    typeScriptExtensions.has(extension) ||
    lowerBaseName === "tsconfig.json" ||
    javaScriptProjectConfigNames.includes(lowerBaseName),
  yaml: ({ extension }) => yamlExtensions.has(extension),
};

function hasConfiguredStageSelection(stageId: StageId): boolean {
  return getRunnerStageConfigurations()?.[stageId] !== undefined;
}

export const defaultStageDefinitions = createRunnerStageDefinitionRegistry([
  createCombinedStageDefinition("lint", [
    "terraform",
    "biome",
    "html",
    "css",
    "yaml",
    "sql",
    "bash",
    "powershell",
    "go",
    "rust",
    "jvm",
    "dotnet",
    "python",
  ]),
  createCombinedStageDefinition("format", [
    "terraform",
    "biome",
    "documents",
    "sql",
    "bash",
    "powershell",
    "go",
    "rust",
    "jvm",
    "dotnet",
    "python",
  ]),
  createCombinedStageDefinition("typecheck", [
    "terraform",
    "go",
    "rust",
    "dotnet",
    "jvm",
    "typescript",
    "python",
  ]),
  createCombinedStageDefinition("unit", [
    "bash",
    "powershell",
    "go",
    "rust",
    "dotnet",
    "jvm",
    "javascript",
    "python",
  ]),
  createCombinedStageDefinition("e2e", ["javascript"]),
  createCombinedStageDefinition("sloc", ["javascript", "go", "rust", "dotnet", "jvm", "python"]),
  createCombinedStageDefinition("complexity", [
    "javascript",
    "go",
    "rust",
    "dotnet",
    "jvm",
    "python",
  ]),
  createCombinedStageDefinition("maintainability", [
    "javascript",
    "go",
    "rust",
    "dotnet",
    "jvm",
    "python",
  ]),
  createCombinedStageDefinition("coverage", [
    "bash",
    "powershell",
    "go",
    "rust",
    "dotnet",
    "jvm",
    "javascript",
    "python",
  ]),
  createCombinedStageDefinition("security", ["security"]),
]);

export async function runStageDefinitionTask(
  task: PlannedTask,
  cwd: string,
  signal?: AbortSignal,
): Promise<StageResult> {
  const stageDefinition = defaultStageDefinitions.byId.get(task.stageId);
  if (stageDefinition === undefined) {
    return createNotImplementedStageResult(task.stageId);
  }

  if (stageDefinition.aggregation === "not_implemented") {
    return createNotImplementedStageResult(task.stageId, stageDefinition.note);
  }

  const handlers = resolveStageHandlers(stageDefinition, task);
  if (handlers.length === 0) {
    if (hasConfiguredStageSelection(task.stageId)) {
      return combineStageResults(task.stageId, []);
    }

    return createNotImplementedStageResult(task.stageId, stageDefinition.note);
  }

  return combineStageResults(
    task.stageId,
    await Promise.all(
      handlers.map(({ files, handler }) => handler({ ...task, files }, { cwd, signal })),
    ),
  );
}

export function resolveStageHandlers(
  stageDefinition: RunnerStageDefinition,
  task: PlannedTask,
): RunnerResolvedStageHandler[] {
  return resolveStageHandlersFromModules(stageDefinition, task, defaultRunnerLanguageModules);
}

export function resolveStageHandlersFromModules(
  stageDefinition: RunnerStageDefinition,
  task: PlannedTask,
  languageModules: Registry<RunnerLanguageModule>,
): RunnerResolvedStageHandler[] {
  const configuredStage = getRunnerStageConfigurations()?.[stageDefinition.id];

  if (configuredStage === undefined) {
    return stageDefinition.moduleIds.flatMap((moduleId) => {
      const languageModule = languageModules.byId.get(moduleId);
      if (languageModule === undefined) {
        throw new Error(
          `Stage definition '${stageDefinition.id}' references unknown language module '${moduleId}'.`,
        );
      }

      const handler = languageModule.stageHandlers[stageDefinition.id];
      return handler === undefined ? [] : [{ files: [...task.files], handler }];
    });
  }

  return groupConfiguredStageLanguages(configuredStage).flatMap(({ languageIds, toolId }) => {
    const languageModule = languageModules.byId.get(toolId);
    if (languageModule === undefined) {
      throw new Error(
        `Stage selection '${stageDefinition.id}' references unknown tool '${toolId}'.`,
      );
    }

    const handler = languageModule.stageHandlers[stageDefinition.id];
    if (handler === undefined) {
      return [];
    }

    return [
      {
        files: filterFilesForConfiguredToolLanguages(task.files, languageIds, toolId),
        handler,
      },
    ];
  });
}

export function createCombinedStageDefinition(
  id: StageId,
  moduleIds: readonly string[],
): RunnerStageDefinition {
  return {
    aggregation: moduleIds.length === 0 ? "not_implemented" : "combine",
    id,
    moduleIds,
    scope: moduleIds.length === 0 ? "stage-only" : "language-modules",
  };
}

function groupConfiguredStageLanguages(stageConfiguration: RunStageConfiguration): Array<{
  languageIds: LanguageId[];
  toolId: string;
}> {
  const languageIdsByTool = new Map<string, LanguageId[]>();

  for (const [languageId, languageConfiguration] of Object.entries(stageConfiguration.languages)) {
    const toolLanguages = languageIdsByTool.get(languageConfiguration.toolId);
    if (toolLanguages === undefined) {
      languageIdsByTool.set(languageConfiguration.toolId, [languageId as LanguageId]);
      continue;
    }

    toolLanguages.push(languageId as LanguageId);
  }

  return [...languageIdsByTool.entries()].map(([toolId, languageIds]) => ({ languageIds, toolId }));
}

function filterFilesForConfiguredLanguages(
  files: readonly string[],
  languageIds: readonly LanguageId[],
): string[] {
  if (languageIds.length === 0) {
    return [];
  }

  return files.filter((file) =>
    languageIds.some((languageId) => fileMatchesLanguage(file, languageId)),
  );
}

function filterFilesForConfiguredToolLanguages(
  files: readonly string[],
  languageIds: readonly LanguageId[],
  toolId: string,
): string[] {
  if (
    toolId === "biome" &&
    (languageIds.includes("javascript") || languageIds.includes("typescript"))
  ) {
    return files.filter((file) => {
      const extension = path.extname(path.resolve(file)).toLowerCase();
      return (
        sharedBiomeExtensions.has(extension) ||
        languageIds.some((languageId) => fileMatchesConfiguredBiomeLanguage(file, languageId))
      );
    });
  }

  return filterFilesForConfiguredLanguages(files, languageIds);
}

function fileMatchesConfiguredBiomeLanguage(file: string, languageId: LanguageId): boolean {
  const normalizedPath = path.resolve(file);
  const extension = path.extname(normalizedPath).toLowerCase();
  const lowerBaseName = path.basename(normalizedPath).toLowerCase();

  switch (languageId) {
    case "javascript":
      return (
        javaScriptExtensions.has(extension) || javaScriptProjectConfigNames.includes(lowerBaseName)
      );
    case "typescript":
      return typeScriptExtensions.has(extension) || lowerBaseName === "tsconfig.json";
    default:
      return fileMatchesLanguage(file, languageId);
  }
}

function fileMatchesLanguage(file: string, languageId: LanguageId): boolean {
  const normalizedPath = path.resolve(file);
  const baseName = path.basename(normalizedPath);
  const matcher = languageFileMatchers[languageId];
  return (
    matcher?.({
      baseName,
      extension: path.extname(normalizedPath).toLowerCase(),
      file,
      lowerBaseName: baseName.toLowerCase(),
    }) ?? false
  );
}
