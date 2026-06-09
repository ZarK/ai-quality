import { realpathSync } from "node:fs";

import type { Diagnostic } from "../contracts.js";
import { resolveDiagnosticFile } from "./diagnostic-path.js";
import { readNumber } from "./record-utils.js";

type ExecutionFailureStageArgs = [
  stageId: string,
  tool: string,
  file: string,
  error: unknown,
  durationMs?: number,
  diagnostics?: Diagnostic[],
  toolRuns?: unknown[],
];

export function deduplicateDiagnostics(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  const seen = new Set<string>();
  const uniqueDiagnostics: Diagnostic[] = [];
  for (const diagnostic of diagnostics) {
    const key = [
      diagnostic.source,
      diagnostic.code ?? "",
      diagnostic.file,
      diagnostic.range?.startLine ?? "",
      diagnostic.range?.startColumn ?? "",
      diagnostic.message,
    ].join("|");
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueDiagnostics.push(diagnostic);
  }

  return uniqueDiagnostics;
}

export function normalizeDiagnosticsToSelection(
  diagnostics: Diagnostic[],
  selectedFiles: readonly string[],
): Diagnostic[] {
  const selectedSet = new Set(selectedFiles.map((file) => file.toLowerCase()));
  return diagnostics.filter((diagnostic) => selectedSet.has(diagnostic.file.toLowerCase()));
}

export function matchDiagnosticFile(file: string, cwd: string): string | undefined {
  return resolveDiagnosticFile(file, cwd);
}

export function tryRealpath(filePath: string): string | undefined {
  try {
    return realpathSync.native(filePath);
  } catch {
    return undefined;
  }
}

export function createFormattingDiagnostic(file: string, source: string): Diagnostic {
  return {
    file,
    message: "File requires formatting.",
    severity: "error",
    source,
  };
}

export function createPrettierDiagnostic(file: string, error: unknown): Diagnostic {
  const message = error instanceof Error ? error.message : String(error);
  const diagnostic: Diagnostic = {
    file,
    message: message.trim() || "Prettier could not parse the file.",
    severity: "error",
    source: "prettier",
  };

  if (typeof error !== "object" || error === null || !("loc" in error)) {
    return diagnostic;
  }

  const location = (
    error as {
      loc?: {
        end?: { column?: number; line?: number };
        start?: { column?: number; line?: number };
      };
    }
  ).loc;
  const startLine = readNumber(location?.start?.line);
  const startColumn = readNumber(location?.start?.column);
  const endLine = readNumber(location?.end?.line);
  const endColumn = readNumber(location?.end?.column);
  if (startLine !== undefined && startColumn !== undefined) {
    diagnostic.range = {
      ...(endColumn === undefined ? {} : { endColumn }),
      ...(endLine === undefined ? {} : { endLine }),
      startColumn,
      startLine,
    };
  }

  return diagnostic;
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

export function createExecutionFailureStage(...input: ExecutionFailureStageArgs): {
  diagnostics: Diagnostic[];
  durationMs: number;
  notes: string[];
  stageId: string;
  status: "failed";
  toolRuns: unknown[];
} {
  const [stageId, tool, file, error, durationMs = 0, diagnostics = [], toolRuns = []] = input;
  const message = error instanceof Error ? error.message : String(error);

  return {
    diagnostics: [...diagnostics, createProcessFailureDiagnostic(file, tool, message)],
    durationMs,
    notes: [message],
    stageId,
    status: "failed",
    toolRuns,
  };
}
