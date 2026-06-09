import { realpathSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { Diagnostic, ToolRunResult } from "../contracts.js";
import * as parsers from "../parsers/index.js";
import * as commands from "../tools/command-builders.js";
import { pathExists } from "../utils/path-utils.js";
import type { DotNetRunnerRuntime } from "./contracts.js";
import { findFirstFile, readJsonValue, readOptionalTextFile } from "./dotnet-metrics-tools.js";
import type { DotNetProject } from "./dotnet.js";
import { resolveDiagnosticsStatus } from "./task-results.js";

export async function runDotNetFormatProject(
  project: DotNetProject,
  runtime: DotNetRunnerRuntime,
  options: {
    failureLabel: string;
    noteLabel: string;
    subcommand: "style" | "whitespace";
    tool: string;
  },
): Promise<{
  diagnostics: Diagnostic[];
  durationMs: number;
  note: string;
  toolRun: ToolRunResult;
}> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "aiq-dotnet-format-"));

  try {
    const reportDir = path.join(tempDir, "report");
    const args = commands.createDotNetFormatArgs({
      reportDir,
      subcommand: options.subcommand,
      targetPath: project.targetPath,
      verifyNoChanges: true,
    });
    const outcome = await runtime.runExecutable(
      runtime.resolveDotNetCommand(),
      args,
      project.projectRoot,
      runtime.signal,
    );
    const report = await readJsonValue(path.join(reportDir, "format-report.json"));
    const parsedDiagnostics = normalizeDiagnosticsToSelection(
      parsers.parseDotNetFormatDiagnostics(report, project.projectRoot),
      project.files,
    );
    const status = outcome.exitCode === 0 && parsedDiagnostics.length === 0 ? "passed" : "failed";

    if (status === "failed" && parsedDiagnostics.length === 0) {
      parsedDiagnostics.push(
        runtime.createProcessFailureDiagnostic(
          project.files[0] ?? project.targetPath,
          "dotnet-format",
          runtime.readProcessFailureMessage(
            options.failureLabel,
            outcome.stderr,
            outcome.stdout,
            outcome.exitCode,
          ),
        ),
      );
    }

    return {
      diagnostics: parsedDiagnostics,
      durationMs: outcome.durationMs,
      note:
        status === "passed"
          ? `${options.noteLabel} passed for ${path.basename(project.targetPath)}.`
          : `${options.noteLabel} reported ${parsedDiagnostics.length} diagnostic${parsedDiagnostics.length === 1 ? "" : "s"} for ${path.basename(project.targetPath)}.`,
      toolRun: runtime.createToolRunResult(
        options.tool,
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

export async function runDotNetTypecheckProject(
  project: DotNetProject,
  runtime: DotNetRunnerRuntime,
): Promise<{
  diagnostics: Diagnostic[];
  durationMs: number;
  note: string;
  toolRun: ToolRunResult;
}> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "aiq-dotnet-build-"));

  try {
    const sarifPath = path.join(tempDir, "build.sarif.json");
    const args = commands.createDotNetBuildArgs({
      errorLog: sarifPath,
      nologo: true,
      targetPath: project.targetPath,
      verbosity: "minimal",
    });
    const outcome = await runtime.runExecutable(
      runtime.resolveDotNetCommand(),
      args,
      project.projectRoot,
      runtime.signal,
    );
    const report = await readJsonValue(sarifPath);
    const parsedDiagnostics = normalizeDiagnosticsToSelection(
      parsers.parseDotNetSarifDiagnostics(report, project.projectRoot),
      project.files,
    );

    if (outcome.exitCode !== 0 && parsedDiagnostics.length === 0) {
      parsedDiagnostics.push(
        runtime.createProcessFailureDiagnostic(
          project.files[0] ?? project.targetPath,
          "dotnet-build",
          runtime.readProcessFailureMessage(
            "dotnet build",
            outcome.stderr,
            outcome.stdout,
            outcome.exitCode,
          ),
        ),
      );
    }

    return {
      diagnostics: parsedDiagnostics,
      durationMs: outcome.durationMs,
      note:
        parsedDiagnostics.length === 0
          ? `dotnet build passed for ${path.basename(project.targetPath)}.`
          : `dotnet build reported ${parsedDiagnostics.length} diagnostic${parsedDiagnostics.length === 1 ? "" : "s"} for ${path.basename(project.targetPath)}.`,
      toolRun: runtime.createToolRunResult(
        "dotnet-build",
        args,
        outcome.durationMs,
        outcome.exitCode,
        outcome.exitCode === 0 && parsedDiagnostics.length === 0 ? "passed" : "failed",
        outcome.finishedAt,
        outcome.startedAt,
      ),
    };
  } finally {
    await rm(tempDir, { force: true, recursive: true }).catch(() => undefined);
  }
}

export async function runDotNetProjectTestTask(
  project: DotNetProject,
  mode: "coverage" | "unit",
  runtime: DotNetRunnerRuntime,
): Promise<{
  diagnostics: Diagnostic[];
  durationMs: number;
  note: string;
  toolRun: ToolRunResult;
}> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "aiq-dotnet-test-"));

  try {
    const trxPath = path.join(tempDir, "results.trx");
    const args = commands.createDotNetTestArgs({
      logger: `trx;LogFileName=${path.basename(trxPath)}`,
      nologo: true,
      resultsDir: tempDir,
      targetPath: project.targetPath,
      verbosity: "minimal",
    });
    if (mode === "coverage") {
      args.push("--collect", "XPlat Code Coverage");
    }

    const outcome = await runtime.runExecutable(
      runtime.resolveDotNetCommand(),
      args,
      project.projectRoot,
      runtime.signal,
    );
    const report = parsers.parseDotNetTrxReport(
      await readOptionalTextFile(trxPath),
      project.projectRoot,
    );
    const coveragePercent = await readDotNetCoveragePercent(mode, tempDir);
    const status =
      outcome.exitCode === 0 ? resolveDiagnosticsStatus(report.diagnostics.length) : "failed";

    addDotNetTestProcessFailureDiagnostic(status, report, project, outcome, runtime);

    return {
      diagnostics: report.diagnostics,
      durationMs: outcome.durationMs,
      note:
        mode === "coverage"
          ? readDotNetCoverageNote(report.summary, coveragePercent)
          : readDotNetUnitNote(report.summary),
      toolRun: runtime.createToolRunResult(
        mode === "coverage" ? "dotnet-test-coverage" : "dotnet-test",
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

async function readDotNetCoveragePercent(
  mode: "coverage" | "unit",
  tempDir: string,
): Promise<number | undefined> {
  if (mode !== "coverage") {
    return undefined;
  }

  const coverageReportPath = await findFirstFile(tempDir, (filePath) =>
    filePath.endsWith("coverage.cobertura.xml"),
  );
  return parsers.readCoberturaLineRate(
    coverageReportPath === undefined ? undefined : await readOptionalTextFile(coverageReportPath),
  );
}

function addDotNetTestProcessFailureDiagnostic(
  status: "failed" | "passed",
  report: ReturnType<typeof parsers.parseDotNetTrxReport>,
  project: DotNetProject,
  outcome: Awaited<ReturnType<DotNetRunnerRuntime["runExecutable"]>>,
  runtime: DotNetRunnerRuntime,
): void {
  if (status !== "failed" || report.diagnostics.length > 0) {
    return;
  }

  report.diagnostics.push(
    runtime.createProcessFailureDiagnostic(
      project.files[0] ?? project.targetPath,
      "dotnet-test",
      runtime.readProcessFailureMessage(
        "dotnet test",
        outcome.stderr,
        outcome.stdout,
        outcome.exitCode,
      ),
    ),
  );
}

export function createUnsupportedDotNetRunnerNote(
  stageId: string,
  files: readonly string[],
): string {
  if (files.length === 0) {
    return `No .NET project or solution target was detected for ${stageId}.`;
  }

  return `No .NET project or solution target was detected for ${stageId} in: ${files.join(", ")}.`;
}

export function readDotNetUnitNote(summary: {
  failed: number;
  passed: number;
  total: number;
}): string {
  if (summary.total === 0) {
    return "dotnet test found no tests.";
  }

  return `dotnet test ran ${summary.total} test${summary.total === 1 ? "" : "s"}: ${summary.passed} passed, ${summary.failed} failed.`;
}

export function readDotNetCoverageNote(
  summary: { failed: number; passed: number; total: number },
  coveragePercent: number | undefined,
): string {
  if (summary.total === 0) {
    return "dotnet test found no tests.";
  }

  if (coveragePercent === undefined) {
    return `dotnet test coverage completed after ${summary.total} test${summary.total === 1 ? "" : "s"}.`;
  }

  return `dotnet test coverage lines: ${coveragePercent.toFixed(1)}% across ${summary.total} test${summary.total === 1 ? "" : "s"}.`;
}

export function normalizeDotNetDiagnosticsToSelection(
  diagnostics: readonly Diagnostic[],
  selectedFiles: readonly string[],
): Diagnostic[] {
  return normalizeDiagnosticsToSelection(diagnostics, selectedFiles);
}

function normalizeDiagnosticsToSelection(
  diagnostics: readonly Diagnostic[],
  selectedFiles: readonly string[],
): Diagnostic[] {
  if (diagnostics.length === 0 || selectedFiles.length === 0) {
    return [...diagnostics];
  }

  const selectedPaths = selectedFiles.map((file) => ({
    file,
    normalized: path.normalize(file),
    realPath: tryRealpath(file),
  }));

  return diagnostics.map((diagnostic) => {
    const matchedFile = matchDiagnosticFile(diagnostic.file, selectedPaths);
    if (matchedFile === undefined || matchedFile === diagnostic.file) {
      return diagnostic;
    }

    return {
      ...diagnostic,
      file: matchedFile,
    };
  });
}

function matchDiagnosticFile(
  file: string,
  selectedPaths: ReadonlyArray<{ file: string; normalized: string; realPath: string | undefined }>,
): string | undefined {
  const normalized = path.normalize(file);
  const directMatch = selectedPaths.find((entry) => entry.normalized === normalized);
  if (directMatch !== undefined) {
    return directMatch.file;
  }

  const realPath = tryRealpath(file);
  if (realPath === undefined) {
    return undefined;
  }

  return selectedPaths.find((entry) => entry.realPath === realPath)?.file;
}

function tryRealpath(filePath: string): string | undefined {
  try {
    return realpathSync.native(filePath);
  } catch {
    return undefined;
  }
}

export * from "./dotnet-metrics-tools.js";
