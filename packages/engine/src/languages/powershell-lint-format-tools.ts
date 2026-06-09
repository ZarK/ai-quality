import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Diagnostic, StageResult, ToolRunResult } from "../contracts.js";
import * as parsers from "../parsers/index.js";
import * as commands from "../tools/command-builders.js";
import type { PowerShellRunnerRuntime } from "./contracts.js";
import {
  matchDiagnosticFile,
  normalizeDiagnosticsToSelection,
  normalizeLineEndings,
  readErrorFilePath,
  toPowerShellStringLiteral,
  tryRealpath,
} from "./powershell-test-tools.js";
import { resolveDiagnosticsStatus } from "./task-results.js";

export async function runPowerShellLintLanguageTask(
  task: { files: string[]; stageId: StageResult["stageId"] },
  runtime: PowerShellRunnerRuntime,
): Promise<StageResult> {
  const args = ["Invoke-ScriptAnalyzer", "-Path", ...task.files];

  try {
    const moduleManifestPath =
      await runtime.resolveRequiredPowerShellModuleManifest("PSScriptAnalyzer");
    const outcome = await runtime.runPowerShellScript(
      [
        "$ErrorActionPreference = 'Stop'",
        `Import-Module -Name ${toPowerShellStringLiteral(moduleManifestPath)} -Force`,
        `$paths = @(${task.files.map((file) => toPowerShellStringLiteral(file)).join(", ")})`,
        "$results = foreach ($path in $paths) {",
        "  Invoke-ScriptAnalyzer -Path $path",
        "}",
        "$results | ConvertTo-Json -Depth 8 -Compress",
        "",
      ].join("\n"),
      runtime.cwd,
      runtime.signal,
    );
    const diagnostics = normalizeDiagnosticsToSelection(
      parsers.parsePowerShellAnalyzerDiagnostics(outcome.stdout, runtime.cwd),
      task.files,
    );
    const status = outcome.exitCode === 0 && diagnostics.length === 0 ? "passed" : "failed";

    addPowerShellLintProcessFailureDiagnostic(status, diagnostics, task.files, outcome, runtime);

    return createPowerShellLintStageResult({
      args,
      diagnostics,
      outcome,
      runtime,
      stageId: task.stageId,
      status,
    });
  } catch (error) {
    runtime.throwIfAbortError(error);
    return runtime.createExecutionFailureStage(
      task.stageId,
      "psscriptanalyzer",
      task.files[0] ?? runtime.cwd,
      error,
    );
  }
}

function addPowerShellLintProcessFailureDiagnostic(
  status: StageResult["status"],
  diagnostics: Diagnostic[],
  files: readonly string[],
  outcome: Awaited<ReturnType<PowerShellRunnerRuntime["runPowerShellScript"]>>,
  runtime: PowerShellRunnerRuntime,
): void {
  if (status !== "failed" || diagnostics.length > 0) {
    return;
  }

  diagnostics.push(
    runtime.createProcessFailureDiagnostic(
      files[0] ?? runtime.cwd,
      "psscriptanalyzer",
      runtime.readProcessFailureMessage(
        "PSScriptAnalyzer",
        outcome.stderr,
        outcome.stdout,
        outcome.exitCode,
      ),
    ),
  );
}

function createPowerShellLintStageResult(args: {
  args: string[];
  diagnostics: Diagnostic[];
  outcome: Awaited<ReturnType<PowerShellRunnerRuntime["runPowerShellScript"]>>;
  runtime: PowerShellRunnerRuntime;
  stageId: StageResult["stageId"];
  status: StageResult["status"];
}): StageResult {
  return {
    diagnostics: args.diagnostics,
    durationMs: args.outcome.durationMs,
    notes:
      args.status === "passed"
        ? ["PSScriptAnalyzer passed."]
        : [
            `PSScriptAnalyzer reported ${args.diagnostics.length} diagnostic${args.diagnostics.length === 1 ? "" : "s"}.`,
          ],
    stageId: args.stageId,
    status: args.status,
    toolRuns: [
      args.runtime.createToolRunResult(
        "psscriptanalyzer",
        args.args,
        args.outcome.durationMs,
        args.outcome.exitCode,
        args.status,
        args.outcome.finishedAt,
        args.outcome.startedAt,
      ),
    ],
  };
}

export async function runPowerShellFormatLanguageTask(
  task: { files: string[]; stageId: StageResult["stageId"] },
  runtime: PowerShellRunnerRuntime,
): Promise<StageResult> {
  const args = ["Invoke-Formatter", "-Path", ...task.files];

  try {
    const originalContents = new Map(
      await Promise.all(
        task.files.map(async (file) => [file, await readFile(file, "utf8")] as const),
      ),
    );
    const moduleManifestPath =
      await runtime.resolveRequiredPowerShellModuleManifest("PSScriptAnalyzer");
    const outcome = await runtime.runPowerShellScript(
      [
        "$ErrorActionPreference = 'Stop'",
        `Import-Module -Name ${toPowerShellStringLiteral(moduleManifestPath)} -Force`,
        `$paths = @(${task.files.map((file) => toPowerShellStringLiteral(file)).join(", ")})`,
        "$results = foreach ($path in $paths) {",
        "  $content = Get-Content -LiteralPath $path -Raw",
        "  [pscustomobject]@{",
        "    Path = (Resolve-Path -LiteralPath $path).Path",
        "    Formatted = (Invoke-Formatter -ScriptDefinition $content)",
        "  }",
        "}",
        "$results | ConvertTo-Json -Depth 8 -Compress",
        "",
      ].join("\n"),
      runtime.cwd,
      runtime.signal,
    );
    const formatResults = parsers.parsePowerShellFormatResults(outcome.stdout, runtime.cwd);
    const formattedByFile = resolvePowerShellFormattedFiles(formatResults, task.files);
    const diagnostics = createPowerShellFormatDiagnostics(
      task.files,
      originalContents,
      formattedByFile,
    );

    addMissingPowerShellFormatOutputDiagnostic(
      outcome.exitCode,
      formatResults.length,
      task.files,
      diagnostics,
      runtime,
    );

    const status = outcome.exitCode === 0 ? resolveDiagnosticsStatus(diagnostics.length) : "failed";

    addPowerShellFormatProcessFailureDiagnostic(status, diagnostics, task.files, outcome, runtime);

    return createPowerShellFormatStageResult({
      args,
      diagnostics,
      outcome,
      runtime,
      stageId: task.stageId,
      status,
    });
  } catch (error) {
    runtime.throwIfAbortError(error);
    return runtime.createExecutionFailureStage(
      task.stageId,
      "invoke-formatter",
      readErrorFilePath(error) ?? task.files[0] ?? runtime.cwd,
      error,
    );
  }
}

function addMissingPowerShellFormatOutputDiagnostic(
  exitCode: number | undefined,
  formatResultCount: number,
  files: readonly string[],
  diagnostics: Diagnostic[],
  runtime: PowerShellRunnerRuntime,
): void {
  if (exitCode !== 0 || formatResultCount === files.length) {
    return;
  }

  diagnostics.push(
    runtime.createProcessFailureDiagnostic(
      files[0] ?? runtime.cwd,
      "invoke-formatter",
      "Invoke-Formatter did not return formatted output for every selected file.",
    ),
  );
}

function createPowerShellFormatStageResult(args: {
  args: string[];
  diagnostics: Diagnostic[];
  outcome: Awaited<ReturnType<PowerShellRunnerRuntime["runPowerShellScript"]>>;
  runtime: PowerShellRunnerRuntime;
  stageId: StageResult["stageId"];
  status: "failed" | "passed";
}): StageResult {
  return {
    diagnostics: args.diagnostics,
    durationMs: args.outcome.durationMs,
    notes: readPowerShellFormatNotes(args.status, args.diagnostics.length),
    stageId: args.stageId,
    status: args.status,
    toolRuns: [
      args.runtime.createToolRunResult(
        "invoke-formatter",
        args.args,
        args.outcome.durationMs,
        args.outcome.exitCode,
        args.status,
        args.outcome.finishedAt,
        args.outcome.startedAt,
      ),
    ],
  };
}

function resolvePowerShellFormattedFiles(
  formatResults: ReturnType<typeof parsers.parsePowerShellFormatResults>,
  files: string[],
): Map<string, string> {
  const selectedPaths = files.map((file) => ({
    file,
    normalized: path.normalize(file),
    realPath: tryRealpath(file),
  }));
  return new Map(
    formatResults.map((entry) => [
      matchDiagnosticFile(entry.file, selectedPaths) ?? entry.file,
      entry.formatted,
    ]),
  );
}

function createPowerShellFormatDiagnostics(
  files: string[],
  originalContents: ReadonlyMap<string, string>,
  formattedByFile: ReadonlyMap<string, string>,
): Diagnostic[] {
  return files.flatMap((file) =>
    shouldReportPowerShellFormatDiagnostic(file, originalContents, formattedByFile)
      ? [
          {
            file,
            message: "File requires formatting.",
            severity: "error" as const,
            source: "invoke-formatter",
          },
        ]
      : [],
  );
}

function shouldReportPowerShellFormatDiagnostic(
  file: string,
  originalContents: ReadonlyMap<string, string>,
  formattedByFile: ReadonlyMap<string, string>,
): boolean {
  const original = originalContents.get(file);
  const formatted = formattedByFile.get(file);
  return (
    original !== undefined &&
    formatted !== undefined &&
    normalizeLineEndings(original) !== normalizeLineEndings(formatted)
  );
}

function addPowerShellFormatProcessFailureDiagnostic(
  status: "failed" | "passed",
  diagnostics: Diagnostic[],
  files: string[],
  outcome: Awaited<ReturnType<PowerShellRunnerRuntime["runPowerShellScript"]>>,
  runtime: PowerShellRunnerRuntime,
): void {
  if (status !== "failed" || diagnostics.length > 0) {
    return;
  }

  diagnostics.push(
    runtime.createProcessFailureDiagnostic(
      files[0] ?? runtime.cwd,
      "invoke-formatter",
      runtime.readProcessFailureMessage(
        "Invoke-Formatter",
        outcome.stderr,
        outcome.stdout,
        outcome.exitCode,
      ),
    ),
  );
}

function readPowerShellFormatNotes(status: "failed" | "passed", diagnosticCount: number): string[] {
  if (status === "passed") {
    return ["Invoke-Formatter passed."];
  }

  return [
    `Invoke-Formatter reported ${diagnosticCount} formatting diagnostic${diagnosticCount === 1 ? "" : "s"}.`,
  ];
}
