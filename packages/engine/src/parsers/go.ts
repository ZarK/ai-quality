import type { Diagnostic } from "../contracts.js";
import { parseGoVetJsonValues } from "./go-vet-json.js";
import {
  deduplicateDiagnostics,
  readIntegerString,
  readString,
  resolveDiagnosticFile,
} from "./utils.js";

export function parseGoVetDiagnostics(stderr: string, stdout: string, cwd: string): Diagnostic[] {
  const candidates = [stderr, stdout, `${stderr}\n${stdout}`]
    .map((value) => value.trim())
    .filter((value, index, values) => value.length > 0 && values.indexOf(value) === index);

  for (const candidate of candidates) {
    const diagnostics = deduplicateDiagnostics(
      parseGoVetJsonValues(candidate).flatMap((value) => collectGoVetDiagnostics(value, cwd)),
    );
    if (diagnostics.length > 0 || candidate === "{}") {
      return diagnostics;
    }
  }

  return [];
}

export function collectGoVetDiagnostics(
  value: unknown,
  cwd: string,
  code: string | undefined = undefined,
): Diagnostic[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectGoVetDiagnostics(entry, cwd, code));
  }

  if (typeof value !== "object" || value === null) {
    return [];
  }

  const record = value as Record<string, unknown>;
  const diagnostics: Diagnostic[] = [];
  const diagnostic = createGoVetDiagnostic(record, cwd, code);
  if (diagnostic !== undefined) {
    diagnostics.push(diagnostic);
  }

  for (const [key, nestedValue] of Object.entries(record)) {
    if (isGoVetMetadataKey(key)) {
      continue;
    }

    diagnostics.push(
      ...collectGoVetDiagnostics(nestedValue, cwd, /^[A-Za-z0-9_-]+$/u.test(key) ? key : code),
    );
  }

  return diagnostics;
}

function createGoVetDiagnostic(
  record: Record<string, unknown>,
  cwd: string,
  code: string | undefined,
): Diagnostic | undefined {
  const position = parseGoPosition(
    readString(record, "posn") ?? readString(record, "position"),
    cwd,
  );
  const message = readString(record, "message");
  if (position === undefined || message === undefined) {
    return undefined;
  }

  return {
    ...(code === undefined ? {} : { code }),
    file: position.file,
    message,
    ...(position.range === undefined ? {} : { range: position.range }),
    severity: "error",
    source: "go-vet",
  };
}

function isGoVetMetadataKey(key: string): boolean {
  return ["message", "posn", "position", "suggestedFixes", "suggested_fixes"].includes(key);
}

export function parseGoCompilerDiagnostics(
  output: string,
  cwd: string,
  source: string,
): Diagnostic[] {
  return deduplicateDiagnostics(
    output
      .split(/\r?\n/u)
      .map((line) => parseGoOutputDiagnosticLine(line, cwd, source))
      .filter((diagnostic): diagnostic is Diagnostic => diagnostic !== undefined),
  );
}

export function parseGoFormatDiagnostics(output: string, cwd: string): Diagnostic[] {
  return output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .flatMap((line) => {
      if (line.length === 0) {
        return [];
      }

      const file = resolveDiagnosticFile(line, cwd);
      if (file === undefined) {
        return [];
      }

      return [
        {
          file,
          message: "File requires formatting.",
          severity: "error" as const,
          source: "gofmt",
        },
      ];
    });
}

export function parseGoCoveragePercent(output: string): number | undefined {
  const match = /^total:\s+\(statements\)\s+(\d+(?:\.\d+)?)%$/mu.exec(output);
  if (match?.[1] === undefined) {
    return undefined;
  }

  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseGoOutputDiagnosticLine(
  line: string,
  cwd: string,
  source: string,
): Diagnostic | undefined {
  const parsed = parseGoOutputDiagnosticParts(line, cwd);
  if (parsed === undefined) {
    return undefined;
  }

  return {
    file: parsed.file,
    message: parsed.message,
    range: {
      startColumn: parsed.startColumn,
      startLine: parsed.startLine,
    },
    severity: "error",
    source,
  };
}

function parseGoOutputDiagnosticParts(
  line: string,
  cwd: string,
): { file: string; message: string; startColumn: number; startLine: number } | undefined {
  const match = /^\s*(.*?\.go):(\d+)(?::(\d+))?:\s*(.+)$/u.exec(line.trim());
  if (match === null) {
    return undefined;
  }

  const parts = {
    file: resolveDiagnosticFile(match[1], cwd),
    message: match[4]?.trim(),
    startColumn: readIntegerString(match[3]),
    startLine: readIntegerString(match[2]),
  };
  if (!hasValidGoDiagnosticParts(parts)) {
    return undefined;
  }

  return {
    file: parts.file,
    message: parts.message,
    startColumn: parts.startColumn ?? 1,
    startLine: parts.startLine,
  };
}

function hasValidGoDiagnosticParts(parts: {
  file: string | undefined;
  message: string | undefined;
  startColumn: number | undefined;
  startLine: number | undefined;
}): parts is { file: string; message: string; startColumn: number | undefined; startLine: number } {
  return (
    parts.file !== undefined &&
    parts.startLine !== undefined &&
    parts.message !== undefined &&
    parts.message.length > 0
  );
}

export function parseGoPosition(
  value: string | undefined,
  cwd: string,
): { file: string; range?: { startColumn: number; startLine: number } } | undefined {
  if (value === undefined) {
    return undefined;
  }

  const match = /^(.*?\.go):(\d+)(?::(\d+))?/u.exec(value.trim());
  if (match === null) {
    return undefined;
  }

  const file = resolveDiagnosticFile(match[1], cwd);
  const startLine = readIntegerString(match[2]);
  const startColumn = readIntegerString(match[3]) ?? 1;
  if (file === undefined || startLine === undefined) {
    return undefined;
  }

  return {
    file,
    range: {
      startColumn,
      startLine,
    },
  };
}
