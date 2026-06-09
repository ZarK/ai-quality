import path from "node:path";

import type { ExecFileError } from "./tool-runner-types.js";

export function isExecFileError(error: unknown): error is ExecFileError {
  return (
    typeof error === "object" &&
    error !== null &&
    ("stdout" in error || "stderr" in error || "code" in error || "signal" in error)
  );
}

export function hasExecFileSignal(error: ExecFileError): boolean {
  return typeof error.signal === "string" && error.signal.length > 0;
}

export function isExpectedExecFileFailure(error: ExecFileError): boolean {
  return typeof error.code === "number" || error.code === "ENOENT" || error.code === "EFTYPE";
}

export function isLookupCommandFailure(error: unknown): boolean {
  if (!isExecFileError(error) || hasExecFileSignal(error)) {
    return false;
  }

  return error.code === "ENOENT" || error.code === "EINVAL";
}

function requiresWindowsCommandShell(command: string): boolean {
  return process.platform === "win32" && /\.(?:bat|cmd)$/iu.test(command);
}

export function selectResolvedCommandPath(stdout: string, commandName: string): string | undefined {
  const resolved = stdout
    .split(/\r?\n/u)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (process.platform !== "win32") {
    return resolved[0];
  }

  return (
    resolved.find((value) => hasWindowsExecutableExtension(value)) ??
    resolved.find((value) => path.basename(value).toLowerCase() === commandName.toLowerCase()) ??
    resolved[0]
  );
}

function hasWindowsExecutableExtension(command: string): boolean {
  return /\.(?:bat|cmd|com|exe)$/iu.test(command);
}

export function createExecFileInvocation(
  command: string,
  args: string[],
): { args: string[]; command: string; windowsVerbatimArguments?: boolean } {
  if (!requiresWindowsCommandShell(command)) {
    return { args, command };
  }

  return {
    args: [
      "/d",
      "/s",
      "/c",
      ["call", quoteWindowsCommandArgument(command), ...args.map(quoteWindowsCommandArgument)].join(
        " ",
      ),
    ],
    command: process.env.ComSpec ?? "cmd.exe",
    windowsVerbatimArguments: true,
  };
}

function quoteWindowsCommandArgument(value: string): string {
  const escaped = value
    .replaceAll("%", "^%")
    .replaceAll('"', '""')
    .replaceAll("\r", "")
    .replaceAll("\n", "");
  return `"${escaped}"`;
}
