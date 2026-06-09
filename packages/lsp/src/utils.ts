import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  AiqEngineCancelledError,
  loadAiqProgress,
  resolveAiqProgressStageIds,
  stageIds,
} from "@tjalve/aiq/api";
import type { Diagnostic, RunResult, StageId } from "@tjalve/aiq/api";
import type {
  AiqLspProgressEvent,
  AiqLspProgressReporter,
  LspDiagnostic,
  LspRange,
  LspTextDocumentIdentifier,
} from "./types.js";
import { AiqLspCancelledError } from "./types.js";

export function resolveDocumentPath(uri: string): string {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    throw new Error(`Invalid LSP document URI: ${uri}`);
  }

  if (url.protocol !== "file:") {
    throw new Error(`Unsupported LSP document URI protocol: ${uri}`);
  }

  return path.resolve(fileURLToPath(url));
}

export function resolveDocumentUri(filePath: string): string {
  return pathToFileURL(path.resolve(filePath)).href;
}

export function collectDiagnosticsForFile(result: RunResult, filePath: string): Diagnostic[] {
  const resolvedFilePath = path.resolve(filePath);
  return result.stages.flatMap((stage) =>
    stage.diagnostics.filter((diagnostic) => path.resolve(diagnostic.file) === resolvedFilePath),
  );
}

export function createResultId(items: readonly LspDiagnostic[]): string {
  const normalizedItems = items
    .map((item) => ({
      code: item.code ?? null,
      message: item.message,
      range: item.range,
      severity: item.severity,
      source: item.source,
    }))
    .sort((left, right) => compareSerializedValues(JSON.stringify(left), JSON.stringify(right)));

  return createHash("sha256").update(JSON.stringify(normalizedItems)).digest("hex");
}

export function groupDiagnosticsByFile(result: RunResult): Map<string, readonly Diagnostic[]> {
  const grouped = new Map<string, Diagnostic[]>();

  for (const stage of result.stages) {
    for (const diagnostic of stage.diagnostics) {
      const filePath = path.resolve(diagnostic.file);
      const existing = grouped.get(filePath);
      if (existing === undefined) {
        grouped.set(filePath, [diagnostic]);
        continue;
      }

      existing.push(diagnostic);
    }
  }

  return grouped;
}

export function isCancellationError(error: unknown): error is AiqLspCancelledError {
  return error instanceof AiqLspCancelledError;
}

export function isAbortError(error: unknown): boolean {
  return (
    error instanceof AiqEngineCancelledError ||
    (error instanceof Error && error.name === "AbortError")
  );
}

export function reportProgress(
  onProgress: AiqLspProgressReporter | undefined,
  event: AiqLspProgressEvent,
): void {
  onProgress?.(event);
}

export function throwIfCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new AiqLspCancelledError();
  }
}

export function toEngineStageIds(stages: readonly string[]): StageId[] {
  const resolved: StageId[] = [];

  for (const stage of stages) {
    if (!stageIds.includes(stage as StageId)) {
      throw new Error(`Unsupported AIQ stage '${stage}' for the LSP adapter.`);
    }

    resolved.push(stage as StageId);
  }

  return resolved;
}

export async function loadFileBackedProgress(cwd: string) {
  const progress = await loadAiqProgress(cwd);
  return progress.source === "file" ? progress : undefined;
}

export function toZeroBasedPosition(value: number): number {
  return Math.max(0, value - 1);
}

export function uniqueTextDocuments(
  textDocuments: readonly LspTextDocumentIdentifier[],
): LspTextDocumentIdentifier[] {
  const documents = new Map<string, LspTextDocumentIdentifier>();

  for (const textDocument of textDocuments) {
    if (!documents.has(textDocument.uri)) {
      documents.set(textDocument.uri, textDocument);
    }
  }

  return [...documents.values()];
}

export function resolveWorkspaceTextDocuments(
  textDocuments: readonly LspTextDocumentIdentifier[],
  diagnosticsByFile: ReadonlyMap<string, readonly Diagnostic[]>,
): LspTextDocumentIdentifier[] {
  const documents = new Map(
    uniqueTextDocuments(textDocuments).map((textDocument) => [textDocument.uri, textDocument]),
  );

  for (const filePath of [...diagnosticsByFile.keys()].sort(compareSerializedValues)) {
    const uri = resolveDocumentUri(filePath);
    if (!documents.has(uri)) {
      documents.set(uri, { uri, version: null });
    }
  }

  return [...documents.values()].sort((left, right) =>
    compareSerializedValues(left.uri, right.uri),
  );
}

function compareSerializedValues(left: string, right: string): number {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}
