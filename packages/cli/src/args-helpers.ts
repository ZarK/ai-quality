import { existsSync } from "node:fs";
import path from "node:path";

import type { BenchmarkScenarioKind } from "@tjalve/aiq/benchmark";
import type { AiqProgressStageIndex } from "@tjalve/aiq/config";
import { type StageId, stageIds } from "@tjalve/aiq/model";

import { type CommandName, cliStageShortcutIds } from "./types.js";

type PublicCommandName = Exclude<CommandName, "first-run">;

const knownCommandNames = [
  "bench",
  "check",
  "ci",
  "config",
  "doctor",
  "evidence",
  "hook",
  "ignore",
  "plan",
  "run",
  "schema",
  "serve",
  "setup",
  "status",
  "watch",
] as const satisfies readonly PublicCommandName[];
const knownCommandNameSet = new Set<string>(knownCommandNames);

export function isSetupGuidanceCommand(command: CommandName): command is "ci" | "hook" | "ignore" {
  return command === "ci" || command === "hook" || command === "ignore";
}

export function parseCommand(command?: string): CommandName {
  if (isCommandName(command)) {
    return command;
  }

  if (command === undefined || command === "--help" || command === "-h") {
    return "run";
  }

  throw new Error(`Unknown command: ${command}`);
}

export function resolveCommandToken(token: string | undefined, cwd: string): string | undefined {
  if (isCommandName(token) || token === "--help" || token === "-h") {
    return token;
  }

  if (token === undefined || token.startsWith("-") || looksLikePath(token, cwd)) {
    return undefined;
  }

  return token;
}

export function isImplicitFirstRun(args: readonly string[], cwd: string): boolean {
  if (args.length === 0) {
    return true;
  }

  const first = args[0];
  if (first === undefined || first === "--help" || first === "-h") {
    return false;
  }

  if (isCommandName(first) || looksLikePath(first, cwd)) {
    return false;
  }

  if (hasExplicitManifestInput(args)) {
    return false;
  }

  if (hasPositionalPathInput(args, cwd)) {
    return false;
  }

  return first.startsWith("-") && argsAreOnlyImplicitFirstRunOptions(args);
}

function hasExplicitManifestInput(args: readonly string[]): boolean {
  return args.some(
    (argument) =>
      argument === "--files" || argument === "--files-from" || argument === "--stdin-file-list",
  );
}

function hasPositionalPathInput(args: readonly string[], cwd: string): boolean {
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined || argument.length === 0) {
      continue;
    }

    if (argument.startsWith("-")) {
      if (flagConsumesNextValue(argument)) {
        index += 1;
      }
      continue;
    }

    if (looksLikePath(argument, cwd)) {
      return true;
    }
  }

  return false;
}

function flagConsumesNextValue(flag: string): boolean {
  return (
    !flag.includes("=") &&
    [
      "--config",
      "--corpus-root",
      "--files",
      "--files-from",
      "--format",
      "--host",
      "--only",
      "--out-dir",
      "--port",
      "--profile",
      "--scenario",
      "--stage",
      "--tag",
      "--up-to",
    ].includes(flag)
  );
}

function argsAreOnlyImplicitFirstRunOptions(args: readonly string[]): boolean {
  const allowedValueFlags = new Set([
    "--format",
    "--only",
    "--out-dir",
    "--profile",
    "--stage",
    "--up-to",
  ]);
  const allowedBooleanFlags = new Set(["--dry-run", "--verbose", "-v"]);

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined) {
      continue;
    }

    if (allowedBooleanFlags.has(argument)) {
      continue;
    }

    if (allowedValueFlags.has(argument)) {
      if (args[index + 1] === undefined) {
        return false;
      }
      index += 1;
      continue;
    }

    return false;
  }

  return true;
}

function isCommandName(token?: string): token is PublicCommandName {
  return token !== undefined && knownCommandNameSet.has(token);
}

function looksLikePath(token: string, cwd: string): boolean {
  return (
    token === "." ||
    token === ".." ||
    token.startsWith("./") ||
    token.startsWith("../") ||
    token.startsWith("/") ||
    token.includes("/") ||
    token.includes("\\") ||
    token.includes(".") ||
    existsSync(path.resolve(cwd, token))
  );
}

export function requireValue(flag: string, value?: string): string {
  if (value === undefined) {
    throw new Error(`Missing value for ${flag}`);
  }

  return value;
}

export function parseIntegerFlag(flag: string, value?: string): number {
  const rawValue = requireValue(flag, value);
  if (!/^\d+$/u.test(rawValue)) {
    throw new Error(`${flag} must be a non-negative integer.`);
  }

  const parsed = Number(rawValue);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${flag} must be a non-negative integer.`);
  }

  return parsed;
}

export function parseStageIdFlag(flag: string, value?: string): StageId {
  const stage = requireValue(flag, value);
  if (!stageIds.includes(stage as StageId)) {
    throw new Error(`Unsupported stage: ${stage}`);
  }

  return stage as StageId;
}

export function resolveCliStageShortcut(flag: string, value?: string): StageId {
  const index = parseIntegerFlag(flag, value);
  const stage = cliStageShortcutIds[index];
  if (stage === undefined) {
    throw new Error(`${flag} must be between 0 and ${cliStageShortcutIds.length - 1}.`);
  }

  return stage;
}

export function resolveCliStagesUpTo(flag: string, value?: string): StageId[] {
  const index = parseIntegerFlag(flag, value);
  if (index >= cliStageShortcutIds.length) {
    throw new Error(`${flag} must be between 0 and ${cliStageShortcutIds.length - 1}.`);
  }

  return [...cliStageShortcutIds.slice(0, index + 1)];
}

export function parseStageIndexFlag(flag: string, value?: string): AiqProgressStageIndex {
  const index = parseIntegerFlag(flag, value);
  if (index >= cliStageShortcutIds.length) {
    throw new Error(`${flag} must be between 0 and ${cliStageShortcutIds.length - 1}.`);
  }

  return index as AiqProgressStageIndex;
}

export function parsePositiveIntegerFlag(flag: string, value?: string): number {
  const parsed = parseIntegerFlag(flag, value);
  if (parsed < 1) {
    throw new Error(`${flag} must be a positive integer.`);
  }

  return parsed;
}

export function parseBenchmarkKind(flag: string, value?: string): BenchmarkScenarioKind {
  const kind = requireValue(flag, value);
  if (kind !== "cold" && kind !== "diff-only" && kind !== "warm") {
    throw new Error(`Unsupported benchmark kind: ${kind}`);
  }

  return kind;
}

export function collectTrailingFiles(args: string[], startIndex: number, target: string[]): number {
  let index = startIndex;
  while (index < args.length) {
    const argument = args[index];
    if (argument === undefined || argument.startsWith("--")) {
      return index - 1;
    }

    target.push(argument);
    index += 1;
  }

  return args.length - 1;
}
