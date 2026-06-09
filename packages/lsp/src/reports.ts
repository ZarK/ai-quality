import path from "node:path";

import type { Diagnostic, RunResult } from "@tjalve/aiq/api";
import type {
  DocumentDiagnosticReport,
  DocumentDiagnosticRequest,
  LspDiagnostic,
  LspDiagnosticSeverity,
  LspPreviousResultId,
  LspRange,
  LspTextDocumentIdentifier,
  WorkspaceDiagnosticReport,
  WorkspaceDiagnosticRequest,
  WorkspaceFullDocumentDiagnosticReport,
  WorkspaceUnchangedDocumentDiagnosticReport,
} from "./types.js";
import { lspDiagnosticSeverities } from "./types.js";
import {
  collectDiagnosticsForFile,
  createResultId,
  groupDiagnosticsByFile,
  resolveDocumentPath,
  resolveWorkspaceTextDocuments,
  toZeroBasedPosition,
} from "./utils.js";

export function createDocumentDiagnosticReportFromRunResult(
  result: RunResult,
  request: Pick<DocumentDiagnosticRequest, "previousResultId" | "textDocument">,
): DocumentDiagnosticReport {
  const filePath = resolveDocumentPath(request.textDocument.uri);
  const diagnostics = collectDiagnosticsForFile(result, filePath);
  return createDocumentDiagnosticReport(
    request.previousResultId === undefined
      ? { diagnostics }
      : {
          diagnostics,
          previousResultId: request.previousResultId,
        },
  );
}

export function createWorkspaceDiagnosticReportFromRunResult(
  result: RunResult,
  request: Pick<WorkspaceDiagnosticRequest, "previousResultIds" | "textDocuments">,
): WorkspaceDiagnosticReport {
  return createWorkspaceDiagnosticReport(
    request.previousResultIds === undefined
      ? {
          diagnosticsByFile: groupDiagnosticsByFile(result),
          textDocuments: request.textDocuments,
        }
      : {
          diagnosticsByFile: groupDiagnosticsByFile(result),
          previousResultIds: request.previousResultIds,
          textDocuments: request.textDocuments,
        },
  );
}

export function createDocumentDiagnosticReport(options: {
  diagnostics: readonly Diagnostic[];
  previousResultId?: string;
}): DocumentDiagnosticReport {
  const items = options.diagnostics.map(mapEngineDiagnosticToLspDiagnostic);
  const resultId = createResultId(items);

  if (options.previousResultId === resultId) {
    return {
      kind: "unchanged",
      resultId,
    };
  }

  return {
    items,
    kind: "full",
    resultId,
  };
}

export function createWorkspaceDiagnosticReport(options: {
  diagnosticsByFile?: ReadonlyMap<string, readonly Diagnostic[]>;
  previousResultIds?: readonly LspPreviousResultId[];
  textDocuments: readonly LspTextDocumentIdentifier[];
}): WorkspaceDiagnosticReport {
  const previousResultIds = new Map(
    (options.previousResultIds ?? []).map((entry) => [entry.uri, entry.value]),
  );
  const diagnosticsByFile = options.diagnosticsByFile ?? new Map<string, readonly Diagnostic[]>();
  const items = resolveWorkspaceTextDocuments(options.textDocuments, diagnosticsByFile).map(
    (textDocument) => {
      const filePath = resolveDocumentPath(textDocument.uri);
      const diagnostics = diagnosticsByFile.get(filePath) ?? [];
      const lspDiagnostics = diagnostics.map(mapEngineDiagnosticToLspDiagnostic);
      const resultId = createResultId(lspDiagnostics);

      if (previousResultIds.get(textDocument.uri) === resultId) {
        return {
          kind: "unchanged",
          resultId,
          uri: textDocument.uri,
          version: textDocument.version ?? null,
        } satisfies WorkspaceUnchangedDocumentDiagnosticReport;
      }

      return {
        items: lspDiagnostics,
        kind: "full",
        resultId,
        uri: textDocument.uri,
        version: textDocument.version ?? null,
      } satisfies WorkspaceFullDocumentDiagnosticReport;
    },
  );

  return { items };
}

export function mapEngineDiagnosticToLspDiagnostic(diagnostic: Diagnostic): LspDiagnostic {
  const lspDiagnostic: LspDiagnostic = {
    message: diagnostic.message,
    range: mapDiagnosticRangeToLspRange(diagnostic.range),
    severity: mapDiagnosticSeverityToLspSeverity(diagnostic.severity),
    source: `aiq/${diagnostic.source}`,
  };

  if (diagnostic.code !== undefined) {
    lspDiagnostic.code = diagnostic.code;
  }

  return lspDiagnostic;
}

export function mapDiagnosticSeverityToLspSeverity(
  severity: Diagnostic["severity"],
): LspDiagnosticSeverity {
  switch (severity) {
    case "error":
      return lspDiagnosticSeverities.error;
    case "warning":
      return lspDiagnosticSeverities.warning;
    case "info":
      return lspDiagnosticSeverities.info;
    default:
      return lspDiagnosticSeverities.hint;
  }
}

export function mapDiagnosticRangeToLspRange(diagnosticRange?: Diagnostic["range"]): LspRange {
  if (diagnosticRange === undefined) {
    return {
      end: { character: 0, line: 0 },
      start: { character: 0, line: 0 },
    };
  }

  const startLine = toZeroBasedPosition(diagnosticRange.startLine);
  const startCharacter = toZeroBasedPosition(diagnosticRange.startColumn);
  const endLine = toZeroBasedPosition(diagnosticRange.endLine ?? diagnosticRange.startLine);
  const endCharacter = toZeroBasedPosition(
    diagnosticRange.endColumn ?? diagnosticRange.startColumn,
  );

  return {
    end: {
      character: endCharacter,
      line: endLine,
    },
    start: {
      character: startCharacter,
      line: startLine,
    },
  };
}
