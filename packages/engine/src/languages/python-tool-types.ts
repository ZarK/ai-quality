import type { Diagnostic, ToolRunResult } from "../contracts.js";
import type { PythonMetricsFileMetrics } from "../parsers/python.js";

export type PythonProject = {
  files: string[];
  projectRoot: string;
};

export type ResolvedTyExecution = {
  argsPrefix: string[];
  command: string;
};

export type PythonToolProjectResult = {
  diagnostics: Diagnostic[];
  durationMs: number;
  toolRun: ToolRunResult;
};

export type PythonProjectExecution = {
  coverageSummary: Record<string, unknown> | undefined;
  coverageSummaryError: string | undefined;
  diagnostics: Diagnostic[];
  summary: { failed: number; passed: number; total: number };
  toolRun: ToolRunResult;
};

export type PythonMetricsProjectMetrics = {
  args: string[];
  durationMs: number;
  exitCode: number | undefined;
  files: Record<string, PythonMetricsFileMetrics>;
  finishedAt: string;
  startedAt: string;
};
