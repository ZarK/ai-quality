import { realpathSync } from "node:fs";
import path from "node:path";

import type { Diagnostic } from "../contracts.js";

export function normalizeDiagnosticsToSelection(
  diagnostics: readonly Diagnostic[],
  selectedFiles: readonly string[],
): Diagnostic[] {
  if (diagnostics.length === 0 || selectedFiles.length === 0) {
    return [...diagnostics];
  }

  const selectedPaths = selectedFiles.map((file) => ({
    file,
    normalized: path.normalize(file),
    realPath: tryRealpath(file),
  }));

  return diagnostics.map((diagnostic) => {
    const normalized = path.normalize(diagnostic.file);
    const diagnosticRealPath = tryRealpath(diagnostic.file);
    const directMatch = selectedPaths.find(
      (entry) => entry.normalized === normalized || entry.realPath === diagnosticRealPath,
    );
    if (directMatch === undefined || directMatch.file === diagnostic.file) {
      return diagnostic;
    }

    return { ...diagnostic, file: directMatch.file };
  });
}

function tryRealpath(filePath: string): string | undefined {
  try {
    return realpathSync.native(filePath);
  } catch {
    return undefined;
  }
}

export function joinOutputs(...values: string[]): string {
  return values.filter((value) => value.length > 0).join("\n");
}
