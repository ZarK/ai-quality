import type { Diagnostic, DiagnosticRange } from "../contracts.js";
import {
  deduplicateDiagnostics,
  normalizeRustSeverity,
  readIntegerString,
  readNestedRecord,
  readNestedString,
  readNumber,
  readRecordArrayFromValue,
  readString,
  resolveDiagnosticFile,
  stripAnsiEscapes,
} from "./utils.js";

export function parseCargoJsonDiagnostics(
  output: string,
  cwd: string,
  source: string,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const line of output.split(/\r?\n/u)) {
    const diagnostic = parseCargoJsonDiagnosticLine(line, cwd, source);
    if (diagnostic !== undefined) {
      diagnostics.push(diagnostic);
    }
  }

  return deduplicateDiagnostics(diagnostics);
}

function parseCargoJsonDiagnosticLine(
  line: string,
  cwd: string,
  source: string,
): Diagnostic | undefined {
  const record = parseRustJsonRecord(line);
  if (record === undefined || readString(record, "reason") !== "compiler-message") {
    return undefined;
  }

  const message = readNestedRecord(record, ["message"]);
  const file = message === undefined ? undefined : readRustDiagnosticFile(message, cwd);
  if (message === undefined || file === undefined) {
    return undefined;
  }

  const diagnostic: Diagnostic = {
    file,
    message:
      readString(message, "message") ??
      readString(message, "rendered") ??
      "Rust compiler reported a diagnostic.",
    severity: normalizeRustSeverity(readString(message, "level")),
    source,
  };
  addRustDiagnosticCode(diagnostic, message);
  addRustDiagnosticRange(diagnostic, message);
  return diagnostic;
}

function parseRustJsonRecord(line: string): Record<string, unknown> | undefined {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function addRustDiagnosticCode(diagnostic: Diagnostic, message: Record<string, unknown>): void {
  const code = readNestedString(message, ["code", "code"]);
  if (code !== undefined) {
    diagnostic.code = code;
  }
}

function addRustDiagnosticRange(diagnostic: Diagnostic, message: Record<string, unknown>): void {
  const range = readRustDiagnosticRange(message);
  if (range !== undefined) {
    diagnostic.range = range;
  }
}

export function readRustDiagnosticFile(
  message: Record<string, unknown>,
  cwd: string,
): string | undefined {
  const spans = readRecordArrayFromValue(message.spans);
  const primarySpan = spans.find((span) => span.is_primary === true) ?? spans[0];
  return resolveDiagnosticFile(readString(primarySpan ?? {}, "file_name"), cwd);
}

export function readRustDiagnosticRange(
  message: Record<string, unknown>,
): DiagnosticRange | undefined {
  const spans = readRecordArrayFromValue(message.spans);
  const primarySpan = spans.find((span) => span.is_primary === true) ?? spans[0];
  if (primarySpan === undefined) {
    return undefined;
  }

  const startLine = readNumber(primarySpan.line_start);
  const startColumn = readNumber(primarySpan.column_start);
  const endLine = readNumber(primarySpan.line_end);
  const endColumn = readNumber(primarySpan.column_end);
  if (startLine === undefined || startColumn === undefined) {
    return undefined;
  }

  return {
    ...(endColumn === undefined ? {} : { endColumn }),
    ...(endLine === undefined ? {} : { endLine }),
    startColumn,
    startLine,
  };
}

export function parseRustFormatDiagnostics(output: string, cwd: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const line of stripAnsiEscapes(output).split(/\r?\n/u)) {
    const match = /^Diff in (.+?\.rs):(\d+):/u.exec(line.trim());
    if (match === null) {
      continue;
    }

    const file = resolveDiagnosticFile(match[1], cwd);
    const startLine = readIntegerString(match[2]);
    if (file === undefined) {
      continue;
    }

    diagnostics.push({
      file,
      message: "File requires formatting.",
      ...(startLine === undefined ? {} : { range: { startColumn: 1, startLine } }),
      severity: "error",
      source: "cargo-fmt",
    });
  }

  return deduplicateDiagnostics(diagnostics);
}
