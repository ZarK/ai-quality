import type { Diagnostic } from "../contracts.js";

export function stripAnsiEscapes(value: string): string {
  const escapeCharacter = String.fromCharCode(27);
  return value.replace(new RegExp(`${escapeCharacter}\\[[0-9;]*m`, "gu"), "");
}

export function joinOutputs(...values: string[]): string {
  return values.filter((value) => value.trim().length > 0).join("\n");
}

export function readProcessFailureMessage(
  toolName: string,
  stderr: string,
  stdout: string,
  exitCode: number | undefined,
): string {
  const combined = joinOutputs(stderr, stdout).trim();
  if (combined.length > 0) {
    return combined;
  }

  return `${toolName} exited with code ${exitCode ?? "unknown"}.`;
}

export function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function capitalize(value: string): string {
  return value.length === 0 ? value : value.slice(0, 1).toUpperCase() + value.slice(1);
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
