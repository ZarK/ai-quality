import type { Diagnostic, StageResult, ToolRunResult } from "../contracts.js";
import * as parsers from "../parsers/index.js";
import * as commands from "../tools/command-builders.js";
import type { BashRunnerRuntime } from "./contracts.js";

export async function runBashLintLanguageTask(
  task: { files: string[]; stageId: StageResult["stageId"] },
  runtime: BashRunnerRuntime,
): Promise<StageResult> {
  const args = commands.createShellcheckArgs({ files: task.files });

  try {
    const outcome = await runtime.runExecutable(
      await runtime.resolveRequiredBinary(
        process.platform === "win32" ? ["shellcheck.exe", "shellcheck"] : ["shellcheck"],
        "ShellCheck",
        "Install ShellCheck to enable Bash linting.",
      ),
      args,
      runtime.cwd,
      runtime.signal,
    );
    const diagnostics = parsers.parseShellcheckDiagnostics(outcome.stdout, runtime.cwd);
    const status = outcome.exitCode === 0 && diagnostics.length === 0 ? "passed" : "failed";

    addBashProcessFailureDiagnostic(status, diagnostics, task, runtime, outcome, {
      failureLabel: "ShellCheck",
      source: "shellcheck",
    });

    return createBashToolStageResult(
      task.stageId,
      diagnostics,
      status,
      {
        args,
        failureLabel: "diagnostic",
        outcome,
        passNote: "ShellCheck passed.",
        reportLabel: "ShellCheck",
        tool: "shellcheck",
      },
      runtime,
    );
  } catch (error) {
    runtime.throwIfAbortError(error);
    return runtime.createExecutionFailureStage(
      task.stageId,
      "shellcheck",
      task.files[0] ?? runtime.cwd,
      error,
    );
  }
}

export async function runBashFormatLanguageTask(
  task: { files: string[]; stageId: StageResult["stageId"] },
  runtime: BashRunnerRuntime,
): Promise<StageResult> {
  const args = commands.createShfmtArgs({ files: task.files });

  try {
    const outcome = await runtime.runExecutable(
      await runtime.resolveRequiredBinary(
        process.platform === "win32" ? ["shfmt.exe", "shfmt"] : ["shfmt"],
        "shfmt",
        "Install shfmt to enable Bash formatting checks.",
      ),
      args,
      runtime.cwd,
      runtime.signal,
    );
    const diagnostics = parsers.parseShellFormatDiagnostics(outcome.stdout, runtime.cwd);
    const status = outcome.exitCode === 0 && diagnostics.length === 0 ? "passed" : "failed";

    addBashProcessFailureDiagnostic(status, diagnostics, task, runtime, outcome, {
      failureLabel: "shfmt",
      source: "shfmt",
    });

    return createBashToolStageResult(
      task.stageId,
      diagnostics,
      status,
      {
        args,
        failureLabel: "formatting diagnostic",
        outcome,
        passNote: "shfmt passed.",
        reportLabel: "shfmt",
        tool: "shfmt",
      },
      runtime,
    );
  } catch (error) {
    runtime.throwIfAbortError(error);
    return runtime.createExecutionFailureStage(
      task.stageId,
      "shfmt",
      task.files[0] ?? runtime.cwd,
      error,
    );
  }
}

function addBashProcessFailureDiagnostic(
  status: StageResult["status"],
  diagnostics: Diagnostic[],
  task: { files: string[] },
  runtime: BashRunnerRuntime,
  outcome: Awaited<ReturnType<BashRunnerRuntime["runExecutable"]>>,
  labels: { failureLabel: string; source: string },
): void {
  if (status !== "failed" || diagnostics.length > 0) {
    return;
  }

  diagnostics.push(
    runtime.createProcessFailureDiagnostic(
      task.files[0] ?? runtime.cwd,
      labels.source,
      runtime.readProcessFailureMessage(
        labels.failureLabel,
        outcome.stderr,
        outcome.stdout,
        outcome.exitCode,
      ),
    ),
  );
}

function createBashToolStageResult(
  stageId: StageResult["stageId"],
  diagnostics: Diagnostic[],
  status: StageResult["status"],
  result: {
    args: string[];
    failureLabel: string;
    outcome: Awaited<ReturnType<BashRunnerRuntime["runExecutable"]>>;
    passNote: string;
    reportLabel: string;
    tool: string;
  },
  runtime: BashRunnerRuntime,
): StageResult {
  return {
    diagnostics,
    durationMs: result.outcome.durationMs,
    notes: [
      status === "passed"
        ? result.passNote
        : `${result.reportLabel} reported ${diagnostics.length} ${result.failureLabel}${diagnostics.length === 1 ? "" : "s"}.`,
    ],
    stageId,
    status,
    toolRuns: [
      runtime.createToolRunResult(
        result.tool,
        result.args,
        result.outcome.durationMs,
        result.outcome.exitCode,
        status,
        result.outcome.finishedAt,
        result.outcome.startedAt,
      ),
    ],
  };
}
