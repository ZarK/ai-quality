import type { StageResult } from "../contracts.js";

export function resolveDiagnosticsStatus(diagnosticCount: number): "failed" | "passed" {
  return diagnosticCount > 0 ? "failed" : "passed";
}

export function resolveUnsupportedSelectionStatus(args: {
  diagnosticCount: number;
  notImplementedCount?: number;
  unsupportedCount: number;
}): StageResult["status"] {
  if (args.diagnosticCount > 0) {
    return "failed";
  }

  return args.unsupportedCount > 0 || (args.notImplementedCount ?? 0) > 0
    ? "not_implemented"
    : "passed";
}
