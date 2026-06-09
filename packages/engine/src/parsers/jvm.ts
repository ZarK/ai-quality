import type { Diagnostic } from "../contracts.js";
import { readIntegerString, resolveDiagnosticFile } from "./utils.js";

export function parseJvmCompilerDiagnostics(
  output: string,
  cwd: string,
  source: string,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const line of output.split(/\r?\n/u)) {
    const diagnostic = parseJvmCompilerDiagnosticLine(line.trim(), cwd, source);
    if (diagnostic !== undefined) {
      diagnostics.push(diagnostic);
    }
  }

  return diagnostics;
}

function parseJvmCompilerDiagnosticLine(
  line: string,
  cwd: string,
  source: string,
): Diagnostic | undefined {
  return (
    parseJavacDiagnosticLine(line, cwd, source) ?? parseKotlinDiagnosticLine(line, cwd, source)
  );
}

function parseJavacDiagnosticLine(
  line: string,
  cwd: string,
  source: string,
): Diagnostic | undefined {
  const match = /^(.*?\.(?:java|kt)):(\d+):(?:(\d+):)?\s*(error|warning):\s*(.+)$/u.exec(line);
  if (match === null) {
    return undefined;
  }

  return {
    file: resolveDiagnosticFile(match[1], cwd) ?? cwd,
    message: match[5] ?? "JVM compiler reported a diagnostic.",
    range: {
      startColumn: readIntegerString(match[3]) ?? 1,
      startLine: readIntegerString(match[2]) ?? 1,
    },
    severity: match[4] === "warning" ? "warning" : "error",
    source,
  };
}

function parseKotlinDiagnosticLine(
  line: string,
  cwd: string,
  source: string,
): Diagnostic | undefined {
  const parsed = parseKotlinDiagnosticParts(line, cwd);
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

function parseKotlinDiagnosticParts(
  line: string,
  cwd: string,
): { file: string; message: string; startColumn: number; startLine: number } | undefined {
  const match = /^e:\s+(file:\/\/)?(.*?\.kt):(\d+):(\d+)\s+(.+)$/u.exec(line);
  if (match === null) {
    return undefined;
  }

  const parts = {
    file: resolveDiagnosticFile(match[2], cwd) ?? cwd,
    message: match[5],
    startColumn: readIntegerString(match[4]),
    startLine: readIntegerString(match[3]),
  };
  if (!hasValidKotlinDiagnosticParts(parts)) {
    return undefined;
  }

  return {
    file: parts.file,
    message: parts.message,
    startColumn: parts.startColumn,
    startLine: parts.startLine,
  };
}

function hasValidKotlinDiagnosticParts(parts: {
  file: string;
  message: string | undefined;
  startColumn: number | undefined;
  startLine: number | undefined;
}): parts is { file: string; message: string; startColumn: number; startLine: number } {
  return (
    parts.message !== undefined && parts.startColumn !== undefined && parts.startLine !== undefined
  );
}
