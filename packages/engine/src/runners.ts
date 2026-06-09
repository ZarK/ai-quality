import { AsyncLocalStorage } from "node:async_hooks";
import { realpathSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import type { Parser as SqlParserClass } from "node-sql-parser";
import * as prettier from "prettier";
import stylelint from "stylelint";
import { parseAllDocuments } from "yaml";

import { createCacheService } from "./cache.js";
import type {
  CacheService,
  Diagnostic,
  EngineContext,
  LanguageId,
  PlannedTask,
  ProjectGraph,
  RunStageConfiguration,
  RunStageConfigurations,
  StageId,
  StageResult,
  ToolRunResult,
  ToolRunStatus,
} from "./contracts.js";
import {
  runBashCoverageTask as runBashCoverageLanguageTask,
  runBashFormatTask as runBashFormatLanguageTask,
  runBashLintTask as runBashLintLanguageTask,
  runBashUnitTask as runBashUnitLanguageTask,
} from "./languages/bash.js";
import type {
  BashRunnerRuntime,
  DotNetRunnerRuntime,
  GoRunnerRuntime,
  HashicorpRunnerRuntime,
  JvmRunnerRuntime,
  PowerShellRunnerRuntime,
  PythonRunnerRuntime,
  RustRunnerRuntime,
} from "./languages/contracts.js";
import {
  runDotNetCoverageTask as runDotNetCoverageLanguageTask,
  runDotNetFormatTask as runDotNetFormatLanguageTask,
  runDotNetLintTask as runDotNetLintLanguageTask,
  runDotNetMetricsTask as runDotNetMetricsLanguageTask,
  runDotNetTypecheckTask as runDotNetTypecheckLanguageTask,
  runDotNetUnitTask as runDotNetUnitLanguageTask,
} from "./languages/dotnet.js";
import {
  runGoCoverageTask as runGoCoverageLanguageTask,
  runGoFormatTask as runGoFormatLanguageTask,
  runGoLintTask as runGoLintLanguageTask,
  runGoMetricsTask as runGoMetricsLanguageTask,
  runGoTypecheckTask as runGoTypecheckLanguageTask,
  runGoUnitTask as runGoUnitLanguageTask,
} from "./languages/go.js";
import {
  runJavaScriptCoverageTask as runJavaScriptCoverageLanguageTask,
  runJavaScriptE2eTask as runJavaScriptE2eLanguageTask,
  runJavaScriptMetricsTask as runJavaScriptMetricsLanguageTask,
  runJavaScriptUnitTask as runJavaScriptUnitLanguageTask,
} from "./languages/javascript.js";
import {
  isJvmTaskFile as isJvmLanguageTaskFile,
  runJvmCoverageTask as runJvmCoverageLanguageTask,
  runJvmFormatTask as runJvmFormatLanguageTask,
  runJvmLintTask as runJvmLintLanguageTask,
  runJvmMetricsTask as runJvmMetricsLanguageTask,
  runJvmTypecheckTask as runJvmTypecheckLanguageTask,
  runJvmUnitTask as runJvmUnitLanguageTask,
} from "./languages/jvm.js";
import {
  runPowerShellCoverageTask as runPowerShellCoverageLanguageTask,
  runPowerShellFormatTask as runPowerShellFormatLanguageTask,
  runPowerShellLintTask as runPowerShellLintLanguageTask,
  runPowerShellUnitTask as runPowerShellUnitLanguageTask,
} from "./languages/powershell.js";
import type { PythonMetricsProjectMetrics } from "./languages/python-tools.js";
import {
  pythonTaskExtensions as pythonExtensions,
  pythonTaskConfigNames,
  runPythonComplexityTask as runPythonComplexityLanguageTask,
  runPythonCoverageTask as runPythonCoverageLanguageTask,
  runPythonFormatTask as runPythonFormatLanguageTask,
  runPythonLintTask as runPythonLintLanguageTask,
  runPythonMaintainabilityTask as runPythonMaintainabilityLanguageTask,
  runPythonSlocTask as runPythonSlocLanguageTask,
  runPythonTypecheckTask as runPythonTypecheckLanguageTask,
  runPythonUnitTask as runPythonUnitLanguageTask,
  selectPythonProjects as selectGraphPythonProjects,
} from "./languages/python.js";
import {
  runRustCoverageTask as runRustCoverageLanguageTask,
  runRustFormatTask as runRustFormatLanguageTask,
  runRustLintTask as runRustLintLanguageTask,
  runRustMetricsTask as runRustMetricsLanguageTask,
  runRustTypecheckTask as runRustTypecheckLanguageTask,
  runRustUnitTask as runRustUnitLanguageTask,
} from "./languages/rust.js";
import {
  isHclFile,
  isTerraformFile,
  runTerraformFormatTask as runTerraformFormatLanguageTask,
  runTerraformLintTask as runTerraformLintLanguageTask,
  runTerraformTypecheckTask as runTerraformTypecheckLanguageTask,
} from "./languages/terraform.js";
import { runTypeScriptTypecheckTask as runTypeScriptTypecheckLanguageTask } from "./languages/typescript.js";
import type * as parsers from "./parsers/index.js";
import { readNestedValue } from "./parsers/utils.js";
import { type Registry, createRegistry } from "./registries.js";
import { AiqEngineCancelledError } from "./run.js";
import { resolveProjectConcurrencyLimit } from "./runtime-tunables.js";
import { ToolRunner } from "./tool-runner.js";
import * as binaries from "./tools/binary-resolver.js";
import * as commands from "./tools/command-builders.js";
import { findNearestBiomeConfig } from "./tools/native-config.js";
import { findNearestAnyConfig, pathExists } from "./utils/path-utils.js";

import { runBiomeFormatTask, runBiomeLintTask } from "./runners-biome-tasks.js";
import {
  createRunnerExecutionContext,
  getCachedRunnerValue,
  getRunnerCache,
  getRunnerExecutionContext,
  getRunnerGraph,
  getRunnerRunScopedValue,
  getRunnerSelectedStages,
  getRunnerStageConfigurations,
  getRunnerToolRunner,
  resetRunnerRunScopedValues,
  runnerExecutionContextStorage,
  setRunnerRunScopedValue,
} from "./runners-context.js";
import {
  createFormattingDiagnostic,
  createMissingStylelintConfigNote,
  createPrettierDiagnostic,
  deduplicateDiagnostics,
  ensureTrailingNewline,
  findFirstFile,
  findMatchingFiles,
  isMissingStylelintConfigError,
  measureOperation,
  normalizeDiagnosticsToSelection,
  parseStylelintDiagnostics,
} from "./runners-file-helpers.js";
import {
  bashExtensions,
  bashTestExtensions,
  biomeExtensions,
  cssExtensions,
  dotNetExtensions,
  dotNetProjectExtensions,
  dotNetSourceExtensions,
  goProjectConfigNames,
  goSourceExtensions,
  htmlExtensions,
  isGoTaskFile,
  isJavaScriptMetricsTaskFile,
  isPythonTaskFile,
  isRustTaskFile,
  javaScriptExtensions,
  javaScriptMetricsSourceExtensions,
  javaScriptProjectConfigNames,
  javaSourceExtensions,
  jvmTaskConfigNames,
  kotlinSourceExtensions,
  powerShellExtensions,
  prettierDocumentExtensions,
  rustProjectConfigNames,
  rustSourceExtensions,
  securityExtensions,
  sharedBiomeExtensions,
  shouldSkipScriptProjectDirectory,
  sqlExtensions,
  typeScriptExtensions,
  yamlExtensions,
} from "./runners-file-types.js";
import { runPrettierDocumentFormatTask, runSqlFormatTask } from "./runners-format-tasks.js";
import {
  createJvmProcessEnv,
  createRustProcessEnv,
  createSharedMetricsNotImplementedNote,
  createUnsupportedJavaScriptRunnerNote,
  filterFiles,
  findSharedNativeConfig,
  isAbortError,
  isMissingCommandOutcome,
  joinOutputs,
  normalizeLineEndings,
  readProcessFailureMessage,
  readSharedMetricsNote,
  resolveBinaryIfAvailable,
  resolveDotNetCommand,
  resolveGradleCommand,
  resolveInstalledBinary,
  resolveMavenCommand,
  resolvePackageBinaryPath,
  resolvePowerShellModuleManifest,
  resolveRequiredBinary,
  resolveRequiredPowerShellModuleManifest,
  resolveUvxCommand,
  runExecutable,
  runNodeTool,
  runPowerShellScript,
  throwIfAbortError,
} from "./runners-process.js";
import {
  combineStageResults,
  createExecutionFailureStage,
  createNoopStageResult,
  createNotImplementedStageResult,
  createProcessFailureDiagnostic,
  createToolRunResult,
  formatError,
  isNoopStageResult,
  readNumber,
  summarizeCombinedStageStatus,
} from "./runners-results.js";
import {
  createBashRunnerRuntime,
  createDotNetRunnerRuntime,
  createGoRunnerRuntime,
  createHashicorpRunnerRuntime,
  createJavaScriptRunnerRuntime,
  createJvmRunnerRuntime,
  createPowerShellRunnerRuntime,
  createPythonRunnerRuntime,
  createRustRunnerRuntime,
  createTypeScriptRunnerRuntime,
} from "./runners-runtimes.js";
import { runSharedSecurityTask } from "./runners-security-task.js";
import type {
  RunnerLanguageModule,
  RunnerResolvedStageHandler,
  RunnerStageDefinition,
} from "./runners-stage-types.js";
import type { SharedMetricsMode } from "./runners-types.js";
import {
  runCssLintTask,
  runHtmlLintTask,
  runSqlLintTask,
  runYamlLintTask,
} from "./runners-web-lint-tasks.js";
export type {
  RunnerLanguageModule,
  RunnerResolvedStageHandler,
  RunnerStageDefinition,
  RunnerStageExecutionContext,
  RunnerStageHandler,
} from "./runners-stage-types.js";
import {
  createRunnerStageDefinitionRegistry,
  defaultRunnerLanguageModules,
} from "./runners-language-modules.js";
import { runStageDefinitionTask } from "./runners-stage-definitions.js";
export {
  defaultStageDefinitions,
  resolveStageHandlers,
  resolveStageHandlersFromModules,
  createCombinedStageDefinition,
} from "./runners-stage-definitions.js";
export {
  createRunnerLanguageModuleRegistry,
  createRunnerStageDefinitionRegistry,
  defaultRunnerLanguageModules,
} from "./runners-language-modules.js";

export {
  combineStageResults,
  createNoopStageResult,
  createNotImplementedStageResult,
  isNoopStageResult,
  summarizeCombinedStageStatus,
} from "./runners-results.js";

export {
  createRunnerExecutionContext,
  resetRunnerRunScopedValues,
  runnerExecutionContextStorage,
} from "./runners-context.js";

type PythonProjectExecution = {
  coverageSummary: Record<string, unknown> | undefined;
  coverageSummaryError: string | undefined;
  diagnostics: Diagnostic[];
  summary: { failed: number; passed: number; total: number };
  toolRun: ToolRunResult;
};

type JvmMetricsFileMetrics = {
  blockCount: number;
  maintainability: {
    rank: string;
    score: number;
  };
  maxComplexity: {
    rank: string;
    score: number;
  };
  raw: {
    sloc: number;
  };
};

type HtmlHintIssue = {
  col: number;
  line: number;
  message: string;
  rule?: {
    id?: string;
  };
  type?: string;
};

type HtmlHintModule = {
  HTMLHint: {
    defaultRuleset: Record<string, unknown>;
    verify: (html: string, ruleset?: Record<string, unknown>) => HtmlHintIssue[];
  };
};

type SqlFormatterModule = {
  format: (sql: string, options?: { language?: parsers.SqlDialect }) => string;
};

type SqlParserModule = {
  Parser: typeof SqlParserClass;
};

const requireModule = createRequire(import.meta.url);
const { Parser: SqlParser } = requireModule("node-sql-parser") as SqlParserModule;
const { HTMLHint } = requireModule("htmlhint") as HtmlHintModule;
const { format: formatSql } = requireModule("sql-formatter") as SqlFormatterModule;

export async function runPlannedTask(
  task: PlannedTask,
  cwdOrContext: EngineContext | string,
  signal?: AbortSignal,
): Promise<StageResult> {
  const runnerContext = createRunnerExecutionContext(cwdOrContext, signal);

  return runnerExecutionContextStorage.run(runnerContext, async () => {
    return runStageDefinitionTask(task, runnerContext.cwd, runnerContext.signal);
  });
}

function hasConfiguredStageSelection(stageId: StageId): boolean {
  return getRunnerStageConfigurations()?.[stageId] !== undefined;
}
