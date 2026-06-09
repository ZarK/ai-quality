import type { Diagnostic } from "../contracts.js";
import {
  normalizeSarifSeverity,
  readIntegerString,
  readNestedRecord,
  readNestedString,
  readNestedValue,
  readNumber,
  readRecordArray,
  readRecordArrayFromValue,
  readString,
  resolveDiagnosticFile,
} from "./utils.js";
import { decodeXmlEntities, parseXmlAttributes } from "./xml.js";

const dotNetStackTraceLocationPatterns = [
  /\bin\s+((?:[A-Za-z]:[\\/][^\r\n]+?\.cs|\\\\[^\r\n]+?\.cs|\/[^\r\n]+?\.cs|(?:\.\.?[\\/])?[^\r\n:]+?\.cs)):line\s+(\d+)/u,
  /((?:[A-Za-z]:[\\/][^\r\n]+?\.cs|\\\\[^\r\n]+?\.cs|\/[^\r\n]+?\.cs|(?:\.\.?[\\/])?[^\r\n:]+?\.cs)):(\d+)/u,
];

export function parseDotNetFormatDiagnostics(report: unknown, cwd: string): Diagnostic[] {
  if (!Array.isArray(report)) {
    return [];
  }

  return report.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) {
      return [];
    }

    const record = entry as Record<string, unknown>;
    const file = resolveDiagnosticFile(
      readString(record, "FilePath") ?? readString(record, "filePath"),
      cwd,
    );
    if (file === undefined) {
      return [];
    }

    const fileChanges = readRecordArrayFromValue(record.FileChanges ?? record.fileChanges);
    if (fileChanges.length > 0) {
      return fileChanges.flatMap((change) => {
        const diagnostic = createDotNetFormatDiagnostic(file, change);
        return diagnostic === undefined ? [] : [diagnostic];
      });
    }

    const diagnostic = createDotNetFormatDiagnostic(file, record);
    return diagnostic === undefined ? [] : [diagnostic];
  });
}

function createDotNetFormatDiagnostic(
  file: string,
  record: Record<string, unknown>,
): Diagnostic | undefined {
  const diagnostic: Diagnostic = {
    file,
    message: readDotNetFormatMessage(record),
    severity: "error",
    source: "dotnet-format",
  };
  addDotNetFormatCode(diagnostic, record);
  addDotNetFormatRange(diagnostic, record);

  return diagnostic;
}

function readDotNetFormatMessage(record: Record<string, unknown>): string {
  return (
    readString(record, "FormatDescription") ??
    readString(record, "formatDescription") ??
    readString(record, "Message") ??
    readString(record, "message") ??
    "File requires formatting."
  );
}

function addDotNetFormatCode(diagnostic: Diagnostic, record: Record<string, unknown>): void {
  const code = readString(record, "DiagnosticId") ?? readString(record, "diagnosticId");
  if (code !== undefined) {
    diagnostic.code = code;
  }
}

function addDotNetFormatRange(diagnostic: Diagnostic, record: Record<string, unknown>): void {
  const lineNumber = readNumber(record.LineNumber ?? record.lineNumber);
  const charNumber = readNumber(record.CharNumber ?? record.charNumber);
  if (lineNumber === undefined || charNumber === undefined) {
    return;
  }

  diagnostic.range = {
    startColumn: charNumber,
    startLine: lineNumber,
  };
}

export function parseDotNetSarifDiagnostics(report: unknown, cwd: string): Diagnostic[] {
  if (typeof report !== "object" || report === null) {
    return [];
  }

  return readRecordArray(report, "runs").flatMap((run) =>
    readRecordArray(run, "results").map((result) => createDotNetSarifDiagnostic(result, cwd)),
  );
}

function createDotNetSarifDiagnostic(result: Record<string, unknown>, cwd: string): Diagnostic {
  const primaryLocation = readRecordArray(result, "locations")[0];
  const diagnostic: Diagnostic = {
    file: readDotNetSarifFile(primaryLocation, cwd),
    message: readDotNetSarifMessage(result),
    severity: normalizeSarifSeverity(readString(result, "level")),
    source: "dotnet-build",
  };
  addDotNetSarifCode(diagnostic, result);
  addDotNetSarifRange(diagnostic, primaryLocation);
  return diagnostic;
}

function readDotNetSarifFile(
  primaryLocation: Record<string, unknown> | undefined,
  cwd: string,
): string {
  return (
    resolveDiagnosticFile(
      readNestedString(primaryLocation ?? {}, ["physicalLocation", "artifactLocation", "uri"]) ??
        readNestedString(primaryLocation ?? {}, ["resultFile", "uri"]),
      cwd,
    ) ?? cwd
  );
}

function readDotNetSarifMessage(result: Record<string, unknown>): string {
  return (
    readNestedString(result, ["message", "text"]) ??
    readNestedString(result, ["message", "markdown"]) ??
    readString(result, "message") ??
    "dotnet build reported a diagnostic."
  );
}

function addDotNetSarifCode(diagnostic: Diagnostic, result: Record<string, unknown>): void {
  const code = readString(result, "ruleId");
  if (code !== undefined) {
    diagnostic.code = code;
  }
}

function addDotNetSarifRange(
  diagnostic: Diagnostic,
  primaryLocation: Record<string, unknown> | undefined,
): void {
  const regionSource =
    readNestedRecord(primaryLocation ?? {}, ["physicalLocation", "region"]) ??
    readNestedRecord(primaryLocation ?? {}, ["resultFile", "region"]);
  const range = readDotNetSarifRange(regionSource ?? {});
  if (range !== undefined) {
    diagnostic.range = range;
  }
}

function readDotNetSarifRange(regionSource: Record<string, unknown>): Diagnostic["range"] {
  const startLine = readNumber(readNestedValue(regionSource, ["startLine"]));
  const startColumn = readNumber(readNestedValue(regionSource, ["startColumn"]));
  if (startLine === undefined || startColumn === undefined) {
    return undefined;
  }

  const endLine = readNumber(readNestedValue(regionSource, ["endLine"]));
  const endColumn = readNumber(readNestedValue(regionSource, ["endColumn"]));
  return {
    ...(endColumn === undefined ? {} : { endColumn }),
    ...(endLine === undefined ? {} : { endLine }),
    startColumn,
    startLine,
  };
}

export function parseDotNetTrxReport(
  reportXml: string | undefined,
  projectRoot: string,
): {
  diagnostics: Diagnostic[];
  summary: { failed: number; passed: number; total: number };
} {
  if (reportXml === undefined) {
    return {
      diagnostics: [],
      summary: { failed: 0, passed: 0, total: 0 },
    };
  }

  const countersMatch = /<Counters\b([^>]*)\/>/u.exec(reportXml);
  const counters = parseXmlAttributes(countersMatch?.[1] ?? "");
  const total = readIntegerString(counters.total) ?? 0;
  const failed = readIntegerString(counters.failed) ?? 0;
  const passed = readIntegerString(counters.passed) ?? Math.max(0, total - failed);
  const diagnostics = readDotNetTrxDiagnostics(reportXml, projectRoot);

  return {
    diagnostics,
    summary: { failed, passed, total },
  };
}

function readDotNetTrxDiagnostics(reportXml: string, projectRoot: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const match of reportXml.matchAll(
    /<UnitTestResult\b([^>]*)>([\s\S]*?)<\/UnitTestResult>|<UnitTestResult\b([^>]*)\/>/gu,
  )) {
    const diagnostic = createDotNetTrxFailureDiagnostic(match, reportXml, projectRoot);
    if (diagnostic !== undefined) {
      diagnostics.push(diagnostic);
    }
  }
  return diagnostics;
}

function createDotNetTrxFailureDiagnostic(
  match: RegExpMatchArray,
  reportXml: string,
  projectRoot: string,
): Diagnostic | undefined {
  const attributes = parseXmlAttributes(match[1] ?? match[3] ?? "");
  if ((attributes.outcome ?? "").toLowerCase() !== "failed") {
    return undefined;
  }

  const failure = readDotNetTrxFailure(match, projectRoot);
  const stackTraceLocation = readDotNetStackTraceLocation(failure.stackTrace, projectRoot);
  const diagnostic: Diagnostic = {
    file: readDotNetTrxFailureFile(reportXml, attributes.testId, stackTraceLocation, projectRoot),
    message: [failure.testName, failure.message, failure.stackTrace]
      .filter((value) => value.trim().length > 0)
      .join("\n"),
    severity: "error",
    source: "dotnet-test",
  };
  addDotNetTrxFailureRange(diagnostic, stackTraceLocation);
  return diagnostic;
}

function readDotNetTrxFailure(
  match: RegExpMatchArray,
  projectRoot: string,
): { message: string; stackTrace: string; testName: string } {
  const attributes = readDotNetTrxAttributes(match);
  const errorInfo = readDotNetTrxErrorInfo(readDotNetTrxResultBlock(match));
  return {
    message: readDotNetTrxErrorText(errorInfo, "Message"),
    stackTrace: readDotNetTrxErrorText(errorInfo, "StackTrace"),
    testName: attributes.testName ?? "dotnet test failure",
  };
}

function readDotNetTrxAttributes(match: RegExpMatchArray): Record<string, string> {
  return parseXmlAttributes(match[1] ?? match[3] ?? "");
}

function readDotNetTrxResultBlock(match: RegExpMatchArray): string {
  return match[2] ?? match[0] ?? "";
}

function readDotNetTrxErrorInfo(resultBlock: string): string {
  return /<ErrorInfo>([\s\S]*?)<\/ErrorInfo>/u.exec(resultBlock)?.[1] ?? "";
}

function readDotNetTrxErrorText(errorInfo: string, tagName: "Message" | "StackTrace"): string {
  return decodeXmlEntities(
    new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, "u").exec(errorInfo)?.[1] ?? "",
  ).trim();
}

function readDotNetTrxFailureFile(
  reportXml: string,
  resultId: string | undefined,
  stackTraceLocation: { file: string; lineNumber?: number } | undefined,
  projectRoot: string,
): string {
  return (
    stackTraceLocation?.file ??
    resolveDiagnosticFile(readDotNetTrxCodeBase(reportXml, resultId), projectRoot) ??
    projectRoot
  );
}

function addDotNetTrxFailureRange(
  diagnostic: Diagnostic,
  stackTraceLocation: { file: string; lineNumber?: number } | undefined,
): void {
  const lineNumber = stackTraceLocation?.lineNumber;
  if (lineNumber !== undefined) {
    diagnostic.range = {
      startColumn: 1,
      startLine: lineNumber,
    };
  }
}

function readDotNetStackTraceLocation(
  stackTrace: string,
  projectRoot: string,
): { file: string; lineNumber?: number } | undefined {
  for (const pattern of dotNetStackTraceLocationPatterns) {
    const match = pattern.exec(stackTrace);
    const file = resolveDiagnosticFile(match?.[1], projectRoot);
    if (file === undefined) {
      continue;
    }

    const lineNumber = readIntegerString(match?.[2]);

    return {
      file,
      ...(lineNumber === undefined ? {} : { lineNumber }),
    };
  }

  return undefined;
}

function readDotNetTrxCodeBase(
  reportXml: string,
  executionId: string | undefined,
): string | undefined {
  if (executionId === undefined || executionId.length === 0) {
    return undefined;
  }

  const escapedExecutionId = escapeRegExp(executionId);
  const unitTestMatch = new RegExp(
    `<UnitTest\\b[^>]*id="${escapedExecutionId}"[^>]*>[\\s\\S]*?<TestMethod\\b([^>]*)\\/>[\\s\\S]*?<\\/UnitTest>`,
    "u",
  ).exec(reportXml);
  if (unitTestMatch === null) {
    return undefined;
  }

  return parseXmlAttributes(unitTestMatch[1] ?? "").codeBase;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
