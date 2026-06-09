import path from "node:path";

import type { Diagnostic } from "../contracts.js";
import { normalizeSeverity } from "./utils.js";

export function parseTscDiagnostics(output: string, cwd: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const lines = output.split(/\r?\n/u);
  let current: Diagnostic | undefined;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }

    const parsedLine = parseTscDiagnosticLine(trimmed, cwd);
    if (parsedLine !== undefined) {
      if (current !== undefined) {
        diagnostics.push(current);
      }

      current = parsedLine;
      continue;
    }

    if (current !== undefined && !/^Found \d+ error/u.test(trimmed)) {
      current.message = `${current.message}\n${trimmed}`;
    }
  }

  if (current !== undefined) {
    diagnostics.push(current);
  }

  return diagnostics;
}

function parseTscDiagnosticLine(line: string, cwd: string): Diagnostic | undefined {
  const match =
    /^(.*?)(?:\((\d+),(\d+)\)|:(\d+):(\d+))(?:\s-\s|:\s*|\s+)(error|warning|info)\s(TS\d+):\s(.+)$/u.exec(
      line,
    );
  if (match === null) {
    return undefined;
  }

  const fields = readTscDiagnosticFields(match);
  if (fields === undefined) {
    return undefined;
  }

  return {
    code: fields.code,
    file: path.resolve(cwd, fields.filePath),
    message: fields.message,
    range: {
      startColumn: Number(fields.startColumnValue),
      startLine: Number(fields.startLineValue),
    },
    severity: normalizeSeverity(match[6]),
    source: "tsc",
  };
}

function readTscDiagnosticFields(match: RegExpExecArray):
  | {
      code: string;
      filePath: string;
      message: string;
      startColumnValue: string;
      startLineValue: string;
    }
  | undefined {
  const fields = {
    code: match[7],
    filePath: match[1],
    message: match[8],
    startColumnValue: match[3] ?? match[5],
    startLineValue: match[2] ?? match[4],
  };
  return Object.values(fields).some((value) => value === undefined)
    ? undefined
    : (fields as {
        code: string;
        filePath: string;
        message: string;
        startColumnValue: string;
        startLineValue: string;
      });
}
