import type {
  Diagnostic,
  PlannedTask,
  ProjectGraph,
  StageId,
  StageResult,
  ToolRunResult,
  ToolRunStatus,
} from "../contracts.js";

export type SharedMetricsMode = "sloc" | "complexity" | "maintainability";

export type NodeProcessOutcome = {
  durationMs: number;
  exitCode: number | undefined;
  finishedAt: string;
  startedAt: string;
  stderr: string;
  stdout: string;
};

type CreateExecutionFailureStage = (
  stageId: StageId,
  tool: string,
  file: string,
  error: unknown,
  durationMs?: number,
  diagnostics?: Diagnostic[],
  toolRuns?: ToolRunResult[],
) => StageResult;

type CreateNoopStageResult = (stageId: StageId, note: string) => StageResult;

type CreateNotImplementedStageResult = (stageId: StageId, note?: string) => StageResult;

type CreateProcessFailureDiagnostic = (file: string, source: string, message: string) => Diagnostic;

type CreateToolRunResult = (
  tool: string,
  args: string[],
  durationMs: number,
  exitCode: number | undefined,
  status: ToolRunStatus,
  finishedAt?: string,
  startedAt?: string,
  cacheHit?: boolean,
) => ToolRunResult;

type ThrowIfAbortError = (error: unknown) => void;

export interface LanguageRunnerBaseRuntime {
  createExecutionFailureStage: CreateExecutionFailureStage;
  createNoopStageResult: CreateNoopStageResult;
  createNotImplementedStageResult: CreateNotImplementedStageResult;
  createProcessFailureDiagnostic: CreateProcessFailureDiagnostic;
  createToolRunResult: CreateToolRunResult;
  cwd: string;
  graph: ProjectGraph | undefined;
  readProcessFailureMessage: (
    toolName: string,
    stderr: string,
    stdout: string,
    exitCode: number | undefined,
  ) => string;
  signal: AbortSignal | undefined;
  throwIfAbortError: ThrowIfAbortError;
}

export interface TypeScriptRunnerRuntime extends LanguageRunnerBaseRuntime {
  joinOutputs: (...values: string[]) => string;
  runNodeTool: (
    scriptPath: string,
    args: string[],
    cwd: string,
    signal?: AbortSignal,
  ) => Promise<NodeProcessOutcome>;
}

export interface JavaScriptRunnerRuntime extends LanguageRunnerBaseRuntime {
  createSharedMetricsNotImplementedNote: (stageId: StageId) => string;
  findMatchingFiles: (
    root: string,
    predicate: (filePath: string) => boolean,
    shouldSkipDirectory: (directoryPath: string) => boolean,
  ) => Promise<string[]>;
  getCachedValue: <T>(
    scope: string,
    manifestKey: string,
    cacheKey: string,
    createValue: () => Promise<T>,
  ) => Promise<{ cacheHit: boolean; value: T }>;
  getRunScopedValue: <T>(scope: string, key: string) => T | undefined;
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
  readUnsupportedRunnerNote: (stageId: StageId, projectRoots: readonly string[]) => string;
  resolveUvxCommand: () => string;
  runExecutable: (
    command: string,
    args: string[],
    cwd: string,
    signal?: AbortSignal,
    env?: NodeJS.ProcessEnv,
  ) => Promise<NodeProcessOutcome>;
  selectedStages: readonly StageId[];
  setRunScopedValue: <T>(scope: string, key: string, value: T) => void;
  shouldSkipProjectDirectory: (directoryPath: string) => boolean;
}

export interface PythonRunnerRuntime extends LanguageRunnerBaseRuntime {
  createSharedMetricsNotImplementedNote: (stageId: StageId) => string;
  findMatchingFiles: (
    root: string,
    predicate: (filePath: string) => boolean,
    shouldSkipDirectory: (directoryPath: string) => boolean,
  ) => Promise<string[]>;
  getCachedValue: <T>(
    scope: string,
    manifestKey: string,
    cacheKey: string,
    createValue: () => Promise<T>,
  ) => Promise<{ cacheHit: boolean; value: T }>;
  getRunScopedValue: <T>(scope: string, key: string) => T | undefined;
  isSharedMetricsCompanionFile: (filePath: string) => boolean;
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
  selectedStages: readonly StageId[];
  setRunScopedValue: <T>(scope: string, key: string, value: T) => void;
  shouldSkipProjectDirectory: (directoryPath: string) => boolean;
}

export interface HashicorpRunnerRuntime extends LanguageRunnerBaseRuntime {
  getCachedValue: <T>(
    scope: string,
    manifestKey: string,
    cacheKey: string,
    createValue: () => Promise<T>,
  ) => Promise<{ cacheHit: boolean; value: T }>;
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
