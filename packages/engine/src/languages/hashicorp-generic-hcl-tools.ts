import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { Diagnostic, StageResult, ToolRunResult } from "../contracts.js";
import * as parsers from "../parsers/index.js";
import type { HashicorpRunnerRuntime } from "./contracts.js";
import { joinOutputs, writeGenericHclTerraformFile } from "./hashicorp-tool-helpers.js";

export type HashicorpProjectToolResult = {
  diagnostics: Diagnostic[];
  durationMs: number;
  note: string;
  status: StageResult["status"];
  toolRun: ToolRunResult;
};

export async function runGenericHclFormatFile(
  file: string,
  terraformBinary: string,
  runtime: HashicorpRunnerRuntime,
): Promise<HashicorpProjectToolResult> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "aiq-hcl-format-"));

  try {
    const tempFile = await writeGenericHclTerraformFile(file, tempDir);
    const args = ["fmt", "-check", path.basename(tempFile)];
    const outcome = await runtime.runExecutable(terraformBinary, args, tempDir, runtime.signal);
    const diagnostics: Diagnostic[] = [];

    if (outcome.exitCode === 3) {
      diagnostics.push({
        file,
        message: "File requires formatting.",
        severity: "error",
        source: "terraform-hcl-format",
      });
    } else if (outcome.exitCode !== 0) {
      diagnostics.push(
        ...parsers.parseTerraformSyntaxDiagnostics(
          joinOutputs(outcome.stderr, outcome.stdout),
          file,
          "terraform-hcl-format",
        ),
      );
    }

    if (outcome.exitCode !== 0 && diagnostics.length === 0) {
      diagnostics.push(
        runtime.createProcessFailureDiagnostic(
          file,
          "terraform-hcl-format",
          runtime.readProcessFailureMessage(
            "terraform fmt",
            outcome.stderr,
            outcome.stdout,
            outcome.exitCode,
          ),
        ),
      );
    }

    const status = outcome.exitCode === 0 && diagnostics.length === 0 ? "passed" : "failed";

    return {
      diagnostics,
      durationMs: outcome.durationMs,
      note:
        status === "passed"
          ? `Generic HCL format passed for ${path.basename(file)}.`
          : `Generic HCL format reported ${diagnostics.length} diagnostic${diagnostics.length === 1 ? "" : "s"} for ${path.basename(file)}.`,
      status,
      toolRun: runtime.createToolRunResult(
        "terraform-hcl-format",
        args,
        outcome.durationMs,
        outcome.exitCode,
        status,
        outcome.finishedAt,
        outcome.startedAt,
      ),
    };
  } finally {
    await rm(tempDir, { force: true, recursive: true }).catch(() => undefined);
  }
}

export async function runGenericHclLintFile(
  file: string,
  terraformBinary: string,
  runtime: HashicorpRunnerRuntime,
): Promise<HashicorpProjectToolResult> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "aiq-hcl-lint-"));

  try {
    const tempFile = await writeGenericHclTerraformFile(file, tempDir);
    const args = ["fmt", path.basename(tempFile)];
    const outcome = await runtime.runExecutable(terraformBinary, args, tempDir, runtime.signal);
    const diagnostics =
      outcome.exitCode === 0
        ? []
        : parsers.parseTerraformSyntaxDiagnostics(
            joinOutputs(outcome.stderr, outcome.stdout),
            file,
            "terraform-hcl-lint",
          );

    if (outcome.exitCode !== 0 && diagnostics.length === 0) {
      diagnostics.push(
        runtime.createProcessFailureDiagnostic(
          file,
          "terraform-hcl-lint",
          runtime.readProcessFailureMessage(
            "terraform fmt",
            outcome.stderr,
            outcome.stdout,
            outcome.exitCode,
          ),
        ),
      );
    }

    const status = outcome.exitCode === 0 && diagnostics.length === 0 ? "passed" : "failed";

    return {
      diagnostics,
      durationMs: outcome.durationMs,
      note:
        status === "passed"
          ? `Generic HCL syntax check passed for ${path.basename(file)}.`
          : `Generic HCL syntax check reported ${diagnostics.length} diagnostic${diagnostics.length === 1 ? "" : "s"} for ${path.basename(file)}.`,
      status,
      toolRun: runtime.createToolRunResult(
        "terraform-hcl-lint",
        args,
        outcome.durationMs,
        outcome.exitCode,
        status,
        outcome.finishedAt,
        outcome.startedAt,
      ),
    };
  } finally {
    await rm(tempDir, { force: true, recursive: true }).catch(() => undefined);
  }
}
