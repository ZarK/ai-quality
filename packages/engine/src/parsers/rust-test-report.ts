import type { Diagnostic, DiagnosticRange } from "../contracts.js";
import { parseCargoJsonDiagnostics } from "./rust.js";
import {
  deduplicateDiagnostics,
  readIntegerString,
  resolveDiagnosticFile,
  stripAnsiEscapes,
} from "./utils.js";

export function parseRustTestReport(
  output: string,
  cwd: string,
  source: string,
  fallbackFile: string,
): {
  diagnostics: Diagnostic[];
  summary: { failed: number; passed: number; total: number };
} {
  const diagnostics = deduplicateDiagnostics([
    ...parseRustTestFailureDiagnostics(output, cwd, source, fallbackFile),
    ...parseCargoJsonDiagnostics(output, cwd, source),
  ]);
  const summary = readRustTestSummary(output, diagnostics.length);
  return {
    diagnostics,
    summary,
  };
}

export function isMissingCargoSubcommand(output: string, subcommand: string): boolean {
  const normalizedOutput = stripAnsiEscapes(output);
  return (
    normalizedOutput.includes(`no such command: \`${subcommand}\``) ||
    normalizedOutput.includes(`no such command: ${subcommand}`)
  );
}

export function parseRustTestFailureDiagnostics(
  output: string,
  cwd: string,
  source: string,
  fallbackFile: string,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const lines = stripAnsiEscapes(output).split(/\r?\n/u);

  for (let index = 0; index < lines.length; index += 1) {
    const blockStart = /^----\s+(.+)\s+stdout\s+----$/u.exec(lines[index]?.trim() ?? "");
    if (blockStart === null) {
      continue;
    }

    const testName = blockStart[1] ?? "Rust test failure";
    const block = readRustTestFailureBlock(lines, index + 1);
    index = block.nextIndex;
    diagnostics.push(createRustTestFailureDiagnostic(testName, block, cwd, source, fallbackFile));
  }

  if (diagnostics.length > 0) {
    return deduplicateDiagnostics(diagnostics);
  }

  return deduplicateDiagnostics(parseRustCompilerTextDiagnostics(output, cwd, source));
}

function createRustTestFailureDiagnostic(
  testName: string,
  block: ReturnType<typeof readRustTestFailureBlock>,
  cwd: string,
  source: string,
  fallbackFile: string,
): Diagnostic {
  const location = block.lines
    .map((line) => parseRustLocationLine(line, cwd))
    .find((value) => value !== undefined);
  return {
    file: location?.file ?? fallbackFile,
    message: readRustTestFailureMessage(testName, block.informativeLines),
    ...(location?.range === undefined ? {} : { range: location.range }),
    severity: "error",
    source,
  };
}

function readRustTestFailureMessage(testName: string, informativeLines: readonly string[]): string {
  return informativeLines.length > 0
    ? `${testName}\n${informativeLines.join("\n")}`
    : `${testName} failed.`;
}

function readRustTestFailureBlock(
  lines: readonly string[],
  startIndex: number,
): { informativeLines: string[]; lines: string[]; nextIndex: number } {
  const blockLines: string[] = [];
  let index = startIndex;
  while (index < lines.length) {
    const trimmed = lines[index]?.trim() ?? "";
    if (/^----\s+.+\s+stdout\s+----$/u.test(trimmed) || trimmed === "failures:") {
      return {
        informativeLines: readNonEmptyLines(blockLines),
        lines: blockLines,
        nextIndex: index - 1,
      };
    }
    blockLines.push(lines[index] ?? "");
    index += 1;
  }

  return { informativeLines: readNonEmptyLines(blockLines), lines: blockLines, nextIndex: index };
}

function readNonEmptyLines(lines: readonly string[]): string[] {
  return lines.filter((line) => line.trim().length > 0);
}

export function parseRustCompilerTextDiagnostics(
  output: string,
  cwd: string,
  source: string,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const lines = stripAnsiEscapes(output).split(/\r?\n/u);
  let current: { code?: string; message: string; severity: Diagnostic["severity"] } | undefined;

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index]?.trim() ?? "";
    const lineResult = readRustCompilerTextLineDiagnostic(trimmed, current, cwd, source);
    current = lineResult.current;
    if (lineResult.diagnostic !== undefined) {
      diagnostics.push(lineResult.diagnostic);
    }
  }

  return diagnostics;
}

function readRustCompilerTextLineDiagnostic(
  line: string,
  current: { code?: string; message: string; severity: Diagnostic["severity"] } | undefined,
  cwd: string,
  source: string,
): {
  current: { code?: string; message: string; severity: Diagnostic["severity"] } | undefined;
  diagnostic?: Diagnostic;
} {
  const header = readRustCompilerHeader(line);
  if (header !== undefined) {
    return { current: header };
  }

  const location = current === undefined ? undefined : readRustCompilerTextLocation(line, cwd);
  if (current === undefined || location === undefined) {
    return { current };
  }

  return {
    current: undefined,
    diagnostic: createRustCompilerTextDiagnostic(current, location, source),
  };
}

function readRustCompilerTextLocation(
  line: string,
  cwd: string,
): { file: string; range?: DiagnosticRange } | undefined {
  const locationMatch = /^-->\s+(.+)$/u.exec(line);
  return locationMatch === null ? undefined : parseRustLocationLine(locationMatch[1] ?? "", cwd);
}

function createRustCompilerTextDiagnostic(
  current: { code?: string; message: string; severity: Diagnostic["severity"] },
  location: { file: string; range?: DiagnosticRange },
  source: string,
): Diagnostic {
  return {
    ...(current.code === undefined ? {} : { code: current.code }),
    file: location.file,
    message: current.message,
    ...(location.range === undefined ? {} : { range: location.range }),
    severity: current.severity,
    source,
  };
}

function readRustCompilerHeader(
  line: string,
): { code?: string; message: string; severity: Diagnostic["severity"] } | undefined {
  const headerMatch = /^(error|warning)(?:\[([^\]]+)\])?:\s+(.+)$/u.exec(line);
  if (headerMatch === null) {
    return undefined;
  }

  return {
    ...(headerMatch[2] === undefined ? {} : { code: headerMatch[2] }),
    message: headerMatch[3] ?? "Rust compiler reported a diagnostic.",
    severity: headerMatch[1] === "warning" ? "warning" : "error",
  };
}

export function parseRustLocationLine(
  line: string,
  cwd: string,
): { file: string; range?: DiagnosticRange } | undefined {
  const trimmed = line.trim();
  const match = readRustLocationMatch(trimmed);
  if (match === null) {
    return undefined;
  }

  const file = resolveDiagnosticFile(match[1], cwd);
  const startLine = readIntegerString(match[2]);
  const startColumn = readIntegerString(match[3]);
  if (file === undefined || startLine === undefined || startColumn === undefined) {
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

function readRustLocationMatch(line: string): RegExpExecArray | null {
  for (const pattern of rustLocationPatterns) {
    const match = pattern.exec(line);
    if (match !== null) {
      return match;
    }
  }

  return null;
}

const rustLocationPatterns = [
  /^(.*?\.rs):(\d+):(\d+)$/u,
  /panicked at (.+?\.rs):(\d+):(\d+)(?::|$)/u,
  /(?:^|\s)([^\s:][^:\n]*?\.rs):(\d+):(\d+)(?::|$)/u,
];

export function readRustTestSummary(
  output: string,
  diagnosticCount: number,
): { failed: number; passed: number; total: number } {
  let passed = 0;
  let failed = 0;

  for (const summaryMatch of stripAnsiEscapes(output).matchAll(
    /test result:\s+(?:ok|FAILED).\s+(\d+) passed;\s+(\d+) failed;/gu,
  )) {
    passed += readIntegerString(summaryMatch[1]) ?? 0;
    failed += readIntegerString(summaryMatch[2]) ?? 0;
  }

  if (passed > 0 || failed > 0) {
    return {
      failed,
      passed,
      total: passed + failed,
    };
  }

  return {
    failed: diagnosticCount,
    passed: 0,
    total: diagnosticCount,
  };
}
