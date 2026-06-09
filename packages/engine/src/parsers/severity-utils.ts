import type { Diagnostic } from "../contracts.js";

export function normalizeSeverity(value: string | undefined): Diagnostic["severity"] {
  if (value === "error" || value === "fatal") {
    return "error";
  }

  if (value === "warning") {
    return "warning";
  }

  return "info";
}

export function normalizeMypySeverity(value: string | undefined): Diagnostic["severity"] {
  if (value === "error") {
    return "error";
  }

  if (value === "warning") {
    return "warning";
  }

  return "info";
}

export function normalizeTySeverity(value: string | undefined): Diagnostic["severity"] {
  if (value === "blocker" || value === "critical" || value === "major") {
    return "error";
  }

  if (value === "minor") {
    return "warning";
  }

  return "info";
}

export function normalizeSarifSeverity(value: string | undefined): Diagnostic["severity"] {
  if (value === "error") {
    return "error";
  }
  if (value === "warning" || value === "note") {
    return "warning";
  }
  return "info";
}

export function normalizeRustSeverity(value: string | undefined): Diagnostic["severity"] {
  if (value === "warning") {
    return "warning";
  }
  if (value === "help" || value === "note" || value === "failure-note") {
    return "info";
  }
  return "error";
}
