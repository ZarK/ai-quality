import { readFile } from "node:fs/promises";

import type { Diagnostic, PlannedTask, StageResult } from "./contracts.js";
import { AiqEngineCancelledError } from "./run.js";
import { securityExtensions } from "./runners-file-types.js";
import { filterFiles, isAbortError } from "./runners-process.js";
import {
  createExecutionFailureStage,
  createNoopStageResult,
  createToolRunResult,
} from "./runners-results.js";

const sharedSecurityPatterns: Array<{ message: string; pattern: RegExp }> = [
  {
    message: "Potential GitHub token detected.",
    pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/u,
  },
  {
    message: "Potential AWS access key detected.",
    pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/u,
  },
  {
    message: "Potential npm token detected.",
    pattern: /\bnpm_[A-Za-z0-9]{36}\b/u,
  },
  {
    message: "Private key material detected.",
    pattern: /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----/u,
  },
];

export async function runSharedSecurityTask(task: PlannedTask): Promise<StageResult> {
  const files = filterFiles(task.files, securityExtensions);
  if (files.length === 0) {
    return createNoopStageResult(
      task.stageId,
      "No JavaScript, TypeScript, JSON, Bash, PowerShell, Python, HTML, CSS, YAML, SQL, Terraform, HCL, .NET, Go, Rust, or JVM files were selected for security scanning.",
    );
  }

  const startedAt = new Date();
  const diagnostics: Diagnostic[] = [];
  let currentFile = files[0] ?? task.files[0] ?? process.cwd();

  try {
    currentFile = await scanSharedSecurityFiles(files, diagnostics);
  } catch (error) {
    if (isAbortError(error)) {
      throw new AiqEngineCancelledError();
    }

    return createExecutionFailureStage(
      task.stageId,
      "aiq-security",
      currentFile,
      error,
      Date.now() - startedAt.getTime(),
      diagnostics,
    );
  }

  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();
  const status = diagnostics.length === 0 ? "passed" : "failed";

  return {
    diagnostics,
    durationMs,
    notes: readSharedSecurityNotes(status, diagnostics.length),
    stageId: task.stageId,
    status,
    toolRuns: [
      createToolRunResult(
        "aiq-security",
        ["scan", ...files],
        durationMs,
        status === "passed" ? 0 : 1,
        status,
        finishedAt.toISOString(),
        startedAt.toISOString(),
      ),
    ],
  };
}

async function scanSharedSecurityFiles(
  files: readonly string[],
  diagnostics: Diagnostic[],
): Promise<string> {
  let currentFile = files[0] ?? process.cwd();
  for (const file of files) {
    currentFile = file;
    diagnostics.push(...(await scanSharedSecurityFile(file)));
  }

  return currentFile;
}

function readSharedSecurityNotes(status: "failed" | "passed", findingCount: number): string[] {
  if (status === "passed") {
    return ["Shared security scan passed."];
  }

  return [`Shared security scan reported ${findingCount} finding${findingCount === 1 ? "" : "s"}.`];
}

async function scanSharedSecurityFile(file: string): Promise<Diagnostic[]> {
  const source = await readFile(file, "utf8");
  return sharedSecurityPatterns.flatMap((rule) => {
    rule.pattern.lastIndex = 0;
    return rule.pattern.test(source)
      ? [
          {
            file,
            message: rule.message,
            severity: "error" as const,
            source: "aiq-security",
          },
        ]
      : [];
  });
}
