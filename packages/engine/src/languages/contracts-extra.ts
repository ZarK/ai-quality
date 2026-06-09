import type { Diagnostic, PlannedTask, StageId, StageResult, ToolRunResult } from "../contracts.js";
import type {
  LanguageRunnerBaseRuntime,
  NodeProcessOutcome,
  SharedMetricsMode,
} from "./contracts-core.js";

export interface JvmRunnerRuntime extends LanguageRunnerBaseRuntime {
  createSharedMetricsNotImplementedNote: (stageId: StageId) => string;
  createJvmProcessEnv: () => Promise<NodeJS.ProcessEnv | undefined>;
  findFirstFile: (
    directory: string,
    predicate: (filePath: string) => boolean,
  ) => Promise<string | undefined>;
  findMatchingFiles: (
    root: string,
    predicate: (filePath: string) => boolean,
    shouldSkipDirectory?: (directoryPath: string) => boolean,
  ) => Promise<string[]>;
  getCachedValue: <T>(
    scope: string,
    manifestKey: string,
    cacheKey: string,
    createValue: () => Promise<T>,
  ) => Promise<{ cacheHit: boolean; value: T }>;
  readSharedMetricsNote: (
    languageLabel: string,
    mode: SharedMetricsMode,
    fileCount: number,
    totalSloc: number,
    totalBlocks: number,
    maxComplexity: number,
    maxRank: string,
    minMaintainability: number,
    minMaintainabilityRank: string,
    emptyBlockLabel: string,
  ) => string;
  resolveGradleCommand: () => string;
  resolveInstalledBinary: (commandName: string) => Promise<string | undefined>;
  resolveMavenCommand: () => string;
  resolveUvxCommand: () => string;
  runExecutable: (
    command: string,
    args: string[],
    cwd: string,
    signal?: AbortSignal,
    env?: NodeJS.ProcessEnv,
  ) => Promise<NodeProcessOutcome>;
}

export interface DotNetRunnerRuntime extends LanguageRunnerBaseRuntime {
  createSharedMetricsNotImplementedNote: (stageId: StageId) => string;
  getCachedValue: <T>(
    scope: string,
    manifestKey: string,
    cacheKey: string,
    createValue: () => Promise<T>,
  ) => Promise<{ cacheHit: boolean; value: T }>;
  readFileText: (filePath: string) => Promise<string>;
  readSharedMetricsNote: (
    languageLabel: string,
    mode: SharedMetricsMode,
    fileCount: number,
    totalSloc: number,
    totalBlocks: number,
    maxComplexity: number,
    maxRank: string,
    minMaintainability: number,
    minMaintainabilityRank: string,
    emptyBlockLabel: string,
  ) => string;
  resolveDotNetCommand: () => string;
  runExecutable: (
    command: string,
    args: string[],
    cwd: string,
    signal?: AbortSignal,
    env?: NodeJS.ProcessEnv,
  ) => Promise<NodeProcessOutcome>;
}

export interface GoRunnerRuntime extends LanguageRunnerBaseRuntime {
  createSharedMetricsNotImplementedNote: (stageId: StageId) => string;
  findMatchingFiles: (
    root: string,
    predicate: (filePath: string) => boolean,
    shouldSkipDirectory?: (directoryPath: string) => boolean,
  ) => Promise<string[]>;
  getCachedValue: <T>(
    scope: string,
    manifestKey: string,
    cacheKey: string,
    createValue: () => Promise<T>,
  ) => Promise<{ cacheHit: boolean; value: T }>;
  readSharedMetricsNote: (
    languageLabel: string,
    mode: SharedMetricsMode,
    fileCount: number,
    totalSloc: number,
    totalBlocks: number,
    maxComplexity: number,
    maxRank: string,
    minMaintainability: number,
    minMaintainabilityRank: string,
    emptyBlockLabel: string,
  ) => string;
  resolveInstalledBinary: (commandName: string) => Promise<string | undefined>;
  resolveUvxCommand: () => string;
  runExecutable: (
    command: string,
    args: string[],
    cwd: string,
    signal?: AbortSignal,
    env?: NodeJS.ProcessEnv,
  ) => Promise<NodeProcessOutcome>;
}

export interface RustRunnerRuntime extends LanguageRunnerBaseRuntime {
  createRustProcessEnv: () => Promise<NodeJS.ProcessEnv | undefined>;
  createSharedMetricsNotImplementedNote: (stageId: StageId) => string;
  findMatchingFiles: (
    root: string,
    predicate: (filePath: string) => boolean,
    shouldSkipDirectory?: (directoryPath: string) => boolean,
  ) => Promise<string[]>;
  getCachedValue: <T>(
    scope: string,
    manifestKey: string,
    cacheKey: string,
    createValue: () => Promise<T>,
  ) => Promise<{ cacheHit: boolean; value: T }>;
  readSharedMetricsNote: (
    languageLabel: string,
    mode: SharedMetricsMode,
    fileCount: number,
    totalSloc: number,
    totalBlocks: number,
    maxComplexity: number,
    maxRank: string,
    minMaintainability: number,
    minMaintainabilityRank: string,
    emptyBlockLabel: string,
  ) => string;
  resolveUvxCommand: () => string;
  resolveInstalledBinary: (commandName: string) => Promise<string | undefined>;
  runExecutable: (
    command: string,
    args: string[],
    cwd: string,
    signal?: AbortSignal,
    env?: NodeJS.ProcessEnv,
  ) => Promise<NodeProcessOutcome>;
}

export interface BashRunnerRuntime extends LanguageRunnerBaseRuntime {
  findFirstFile: (
    directory: string,
    predicate: (filePath: string) => boolean,
  ) => Promise<string | undefined>;
  findMatchingFiles: (
    root: string,
    predicate: (filePath: string) => boolean,
    shouldSkipDirectory?: (directoryPath: string) => boolean,
  ) => Promise<string[]>;
  isMissingCommandOutcome: (
    stderr: string,
    stdout: string,
    exitCode: number | undefined,
  ) => boolean;
  resolveBinaryIfAvailable: (commandNames: readonly string[]) => Promise<string | undefined>;
  resolveRequiredBinary: (
    commandNames: readonly string[],
    toolName: string,
    installMessage: string,
  ) => Promise<string>;
  runExecutable: (
    command: string,
    args: string[],
    cwd: string,
    signal?: AbortSignal,
    env?: NodeJS.ProcessEnv,
  ) => Promise<NodeProcessOutcome>;
}

export interface PowerShellRunnerRuntime extends LanguageRunnerBaseRuntime {
  findMatchingFiles: (
    root: string,
    predicate: (filePath: string) => boolean,
    shouldSkipDirectory?: (directoryPath: string) => boolean,
  ) => Promise<string[]>;
  resolvePowerShellModuleManifest: (moduleName: string) => Promise<string | undefined>;
  resolveRequiredPowerShellModuleManifest: (moduleName: string) => Promise<string>;
  runPowerShellScript: (
    script: string,
    cwd: string,
    signal?: AbortSignal,
  ) => Promise<NodeProcessOutcome>;
}

export type LanguageStageHandler<TContext extends LanguageRunnerBaseRuntime> = (
  task: PlannedTask,
  context: TContext,
) => Promise<StageResult>;
