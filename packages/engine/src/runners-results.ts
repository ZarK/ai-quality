import type {
  Diagnostic,
  StageId,
  StageResult,
  ToolRunResult,
  ToolRunStatus,
} from "./contracts.js";

type ToolRunResultArgs = [
  tool: string,
  args: string[],
  durationMs: number,
  exitCode: number | undefined,
  status: ToolRunStatus,
  finishedAt?: string,
  startedAt?: string,
  cacheHit?: boolean,
];

type ExecutionFailureStageArgs = [
  stageId: StageId,
  tool: string,
  file: string,
  error: unknown,
  durationMs?: number,
  diagnostics?: Diagnostic[],
  toolRuns?: ToolRunResult[],
];

export function createNotImplementedStageResult(stageId: StageId, note?: string): StageResult {
  return {
    diagnostics: [],
    durationMs: 0,
    notes: [
      note ??
        `Stage '${stageId}' is planned but no tool runner is implemented in the rewrite foundation slice yet.`,
    ],
    stageId,
    status: "not_implemented",
    toolRuns: [],
  };
}

export function createNoopStageResult(stageId: StageId, note: string): StageResult {
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
  stageId: StageId,
  results: readonly StageResult[],
): StageResult {
  const activeResults = results.filter((result) => !isNoopStageResult(result));
  if (activeResults.length === 0) {
    if (stageId === "e2e" && results.length > 0) {
      return {
        diagnostics: [],
        durationMs: 0,
        notes: results.flatMap((result) => result.notes),
        stageId,
        status: "passed",
        toolRuns: [],
      };
    }

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

export function isNoopStageResult(result: StageResult): boolean {
  return (
    result.status === "passed" &&
    result.durationMs === 0 &&
    result.diagnostics.length === 0 &&
    result.toolRuns.length === 0
  );
}

export function summarizeCombinedStageStatus(
  results: readonly StageResult[],
): StageResult["status"] {
  if (results.some((result) => result.status === "failed")) {
    return "failed";
  }

  if (
    results.some((result) => result.status === "passed" && result.toolRuns.length > 0) &&
    results.every(
      (result) => result.status !== "not_implemented" || isUnsupportedScopeResult(result),
    )
  ) {
    return "passed";
  }

  if (results.some((result) => result.status === "not_implemented")) {
    return "not_implemented";
  }

  return "passed";
}

function isUnsupportedScopeResult(result: StageResult): boolean {
  return (
    result.diagnostics.length === 0 &&
    result.toolRuns.length === 0 &&
    result.notes.every((note) => {
      const normalizedNote = note.toLowerCase();
      return (
        normalizedNote.startsWith("no supported ") ||
        normalizedNote.startsWith("no runnable ") ||
        normalizedNote.startsWith("no javascript or typescript files were selected") ||
        normalizedNote.startsWith("no python files were selected") ||
        (normalizedNote.startsWith("stage '") &&
          normalizedNote.includes("currently implemented only for"))
      );
    })
  );
}

export function createToolRunResult(...input: ToolRunResultArgs): ToolRunResult {
  const [tool, args, durationMs, exitCode, status, finishedAt, startedAt, cacheHit = false] = input;
  const result: ToolRunResult = {
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

export function createExecutionFailureStage(...input: ExecutionFailureStageArgs): StageResult {
  const [stageId, tool, file, error, durationMs = 0, diagnostics = [], toolRuns = []] = input;
  const message = formatError(error);

  return {
    diagnostics: [...diagnostics, createProcessFailureDiagnostic(file, tool, message)],
    durationMs,
    notes: [message],
    stageId,
    status: "failed",
    toolRuns,
  };
}

export function createProcessFailureDiagnostic(
  file: string,
  source: string,
  message: string,
): Diagnostic {
  return {
    file,
    message,
    severity: "error",
    source,
  };
}

export function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
