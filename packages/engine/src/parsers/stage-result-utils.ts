import type { Diagnostic, StageResult, ToolRunResult, ToolRunStatus } from "../contracts.js";

type ToolRunResultArgs = [
  tool: string,
  args: string[],
  durationMs: number,
  exitCode: number | undefined,
  status: "failed" | "not_implemented" | "passed",
  finishedAt?: string,
  startedAt?: string,
  cacheHit?: boolean,
];

export function createNoopStageResult(
  stageId: string,
  note: string,
): {
  diagnostics: Diagnostic[];
  durationMs: number;
  notes: string[];
  stageId: string;
  status: "passed";
  toolRuns: unknown[];
} {
  return {
    diagnostics: [],
    durationMs: 0,
    notes: [note],
    stageId,
    status: "passed",
    toolRuns: [],
  };
}

export function combineStageResults(
  stageId: string,
  results: readonly {
    diagnostics: Diagnostic[];
    durationMs: number;
    notes: string[];
    stageId: string;
    status: "failed" | "not_implemented" | "passed";
    toolRuns: unknown[];
  }[],
): {
  diagnostics: Diagnostic[];
  durationMs: number;
  notes: string[];
  stageId: string;
  status: "failed" | "not_implemented" | "passed";
  toolRuns: unknown[];
} {
  const activeResults = results.filter((result) => !isNoopStageResult(result));
  if (activeResults.length === 0) {
    return createNoopStageResult(stageId, `No supported files were selected for ${stageId}.`);
  }

  return {
    diagnostics: activeResults.flatMap((result) => result.diagnostics),
    durationMs: activeResults.reduce((total, result) => total + result.durationMs, 0),
    notes: activeResults.flatMap((result) => result.notes),
    stageId,
    status: summarizeCombinedStageStatus(activeResults),
    toolRuns: activeResults.flatMap((result) => result.toolRuns),
  };
}

export function isNoopStageResult(result: {
  diagnostics: Diagnostic[];
  durationMs: number;
  status: string;
  toolRuns: unknown[];
}): boolean {
  return (
    result.status === "passed" &&
    result.durationMs === 0 &&
    result.diagnostics.length === 0 &&
    result.toolRuns.length === 0
  );
}

export function summarizeCombinedStageStatus(
  results: readonly { status: "failed" | "not_implemented" | "passed" }[],
): "failed" | "not_implemented" | "passed" {
  if (results.some((result) => result.status === "failed")) {
    return "failed";
  }

  if (results.some((result) => result.status === "not_implemented")) {
    return "not_implemented";
  }

  return "passed";
}

export function createToolRunResult(...input: ToolRunResultArgs): {
  args: string[];
  cacheHit: boolean;
  durationMs: number;
  exitCode?: number;
  finishedAt?: string;
  startedAt?: string;
  status: "failed" | "not_implemented" | "passed";
  tool: string;
} {
  const [tool, args, durationMs, exitCode, status, finishedAt, startedAt, cacheHit = false] = input;
  const result: {
    args: string[];
    cacheHit: boolean;
    durationMs: number;
    exitCode?: number;
    finishedAt?: string;
    startedAt?: string;
    status: "failed" | "not_implemented" | "passed";
    tool: string;
  } = {
    args,
    cacheHit,
    durationMs,
    ...(finishedAt === undefined ? {} : { finishedAt }),
    ...(startedAt === undefined ? {} : { startedAt }),
    status,
    tool,
  };

  if (exitCode !== undefined) {
    result.exitCode = exitCode;
  }

  return result;
}

export function cloneToolRunResult(
  toolRun: {
    args: string[];
    durationMs: number;
    exitCode?: number;
    finishedAt?: string;
    startedAt?: string;
    status: "failed" | "not_implemented" | "passed";
    tool: string;
  },
  cacheHit: boolean,
): {
  args: string[];
  cacheHit: boolean;
  durationMs: number;
  exitCode?: number;
  finishedAt?: string;
  startedAt?: string;
  status: "failed" | "not_implemented" | "passed";
  tool: string;
} {
  return createToolRunResult(
    toolRun.tool,
    toolRun.args,
    cacheHit ? 0 : toolRun.durationMs,
    toolRun.exitCode,
    toolRun.status,
    toolRun.finishedAt,
    toolRun.startedAt,
    cacheHit,
  );
}
