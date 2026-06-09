import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  createAiqProgressRunSelection,
  createRunPlan,
  formatRunResultAsText,
  resolveAiqConfig,
  resolveAiqProgressStageIds,
  runEngine,
} from "@tjalve/aiq/api";
import type { AiqProfileName, RunRequest, RunResult, StageId } from "@tjalve/aiq/api";
import {
  assertExplainOptions,
  formatDiagnosticExplanation,
  formatMcpPlanText,
  formatMcpStatusText,
  loadFileBackedProgress,
  mapResolvedSelection,
  normalizeExplicitFiles,
  normalizeOptionalString,
  normalizeProfileOverride,
  normalizeStageOverride,
} from "./helpers.js";
import type {
  AiqMcpCheckOptions,
  AiqMcpCheckResult,
  AiqMcpExplainOptions,
  AiqMcpExplainResult,
  AiqMcpPlanResult,
  AiqMcpServerOptions,
  AiqMcpStatusResult,
  ResolvedMcpSelection,
} from "./types.js";

export class AiqMcpAdapter {
  private readonly cwd: string;

  private readonly stages: readonly StageId[] | undefined;

  private readonly profile: AiqProfileName | undefined;

  private readonly readFileImpl: typeof readFile;

  private readonly resolveConfigImpl: typeof resolveAiqConfig;

  private readonly runEngineImpl: typeof runEngine;

  private readonly writeArtifacts: boolean;

  constructor(options: AiqMcpServerOptions = {}) {
    this.cwd = path.resolve(options.cwd ?? process.cwd());
    this.stages = options.stages;
    this.profile = options.profile;
    this.readFileImpl = options.readFileImpl ?? readFile;
    this.resolveConfigImpl = options.resolveConfigImpl ?? resolveAiqConfig;
    this.runEngineImpl = options.runEngineImpl ?? runEngine;
    this.writeArtifacts = options.writeArtifacts ?? false;
  }

  async check(options: AiqMcpCheckOptions): Promise<AiqMcpCheckResult> {
    const cwd = path.resolve(options.cwd ?? this.cwd);
    const files = normalizeExplicitFiles(cwd, options.files);
    if (files.length === 0) {
      throw new Error("MCP AIQ checks require at least one file.");
    }

    const selection = await this.resolveSelection(cwd, options);
    const report = await this.runEngineImpl({
      context: "mcp",
      cwd: selection.cwd,
      manifest: {
        files,
        source: "direct",
      },
      mode: "check",
      ...(options.outDir === undefined ? {} : { outDir: options.outDir }),
      stages: selection.stages,
      ...(selection.stageConfigurations === undefined
        ? {}
        : { stageConfigurations: selection.stageConfigurations }),
      profile: selection.profile,
      ...(options.signal === undefined ? {} : { signal: options.signal }),
      writeArtifacts: this.writeArtifacts,
    });

    return {
      files,
      ok: report.ok,
      ...(report.artifacts.planPath === undefined ? {} : { planPath: report.artifacts.planPath }),
      report,
      ...(report.artifacts.reportPath === undefined
        ? {}
        : { reportPath: report.artifacts.reportPath }),
      text: formatRunResultAsText(report).trimEnd(),
      ...(selection.workflow === undefined ? {} : { workflow: selection.workflow }),
    };
  }

  async plan(options: AiqMcpCheckOptions): Promise<AiqMcpPlanResult> {
    const cwd = path.resolve(options.cwd ?? this.cwd);
    const files = normalizeExplicitFiles(cwd, options.files);
    if (files.length === 0) {
      throw new Error("MCP AIQ plans require at least one file.");
    }

    const selection = await this.resolveSelection(cwd, options);
    const request = this.createRunRequest(selection, files, "plan", options);
    const plan = await createRunPlan(request);
    return {
      files,
      plan,
      text: formatMcpPlanText(plan),
      ...(selection.workflow === undefined ? {} : { workflow: selection.workflow }),
    };
  }

  async status(options: { cwd?: string } = {}): Promise<AiqMcpStatusResult> {
    const cwd = path.resolve(options.cwd ?? this.cwd);
    const selection = await this.resolveSelection(cwd, {});
    return {
      cwd: selection.cwd,
      profile: selection.profile,
      stages: selection.stages,
      text: formatMcpStatusText(selection),
      ...(selection.workflow === undefined ? {} : { workflow: selection.workflow }),
    };
  }

  async explain(options: AiqMcpExplainOptions): Promise<AiqMcpExplainResult> {
    assertExplainOptions(options);
    const cwd = path.resolve(options.cwd ?? this.cwd);
    const reportPath = normalizeOptionalString(options.reportPath);
    const report =
      reportPath === undefined
        ? (
            await this.check({
              files: options.files ?? [],
              ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
              ...(options.outDir === undefined ? {} : { outDir: options.outDir }),
              ...(options.stages === undefined ? {} : { stages: options.stages }),
              ...(options.profile === undefined ? {} : { profile: options.profile }),
              ...(options.signal === undefined ? {} : { signal: options.signal }),
            })
          ).report
        : await this.readReportArtifact(path.resolve(cwd, reportPath));

    return {
      diagnosticCount: report.summary.diagnosticCount,
      report,
      ...(report.artifacts.reportPath === undefined
        ? {}
        : { reportPath: report.artifacts.reportPath }),
      text: formatDiagnosticExplanation(report),
    };
  }

  private async readReportArtifact(reportPath: string): Promise<RunResult> {
    let report: Partial<RunResult>;

    try {
      report = JSON.parse(await this.readFileImpl(reportPath, "utf8")) as Partial<RunResult>;
    } catch (error) {
      throw new Error(
        `Failed to read AIQ report artifact at ${reportPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (report.artifactType !== "report") {
      throw new Error(`Expected an AIQ report artifact at ${reportPath}.`);
    }

    return report as RunResult;
  }

  private createRunRequest(
    selection: ResolvedMcpSelection,
    files: readonly string[],
    mode: RunRequest["mode"],
    options: Pick<AiqMcpCheckOptions, "outDir" | "signal">,
  ): RunRequest {
    return {
      context: "mcp",
      cwd: selection.cwd,
      manifest: {
        files,
        source: "direct",
      },
      mode,
      ...(options.outDir === undefined ? {} : { outDir: options.outDir }),
      stages: selection.stages,
      ...(selection.stageConfigurations === undefined
        ? {}
        : { stageConfigurations: selection.stageConfigurations }),
      profile: selection.profile,
      ...(options.signal === undefined ? {} : { signal: options.signal }),
      writeArtifacts: this.writeArtifacts,
    };
  }

  private async resolveSelection(
    cwd: string,
    options: Pick<AiqMcpCheckOptions, "stages" | "profile">,
  ): Promise<ResolvedMcpSelection> {
    const adapterStages =
      this.stages === undefined || this.stages.length === 0 ? undefined : [...this.stages];
    const adapterProfile = this.profile;
    const optionStages = normalizeStageOverride(options.stages, "MCP stages");
    const optionProfile = normalizeProfileOverride(options.profile, "MCP profile");
    const progress =
      adapterStages === undefined &&
      adapterProfile === undefined &&
      optionStages === undefined &&
      optionProfile === undefined
        ? await loadFileBackedProgress(cwd)
        : undefined;
    const resolved = await this.resolveConfigImpl({
      cwd,
      ...(adapterStages === undefined
        ? progress === undefined
          ? {}
          : { stages: resolveAiqProgressStageIds(progress.progress.current_stage) }
        : { stages: adapterStages }),
      ...(adapterProfile === undefined ? {} : { profile: adapterProfile }),
      ...(optionStages === undefined ? {} : { stages: optionStages }),
      ...(optionProfile === undefined ? {} : { profile: optionProfile }),
      surface: "mcp",
    });

    return {
      ...mapResolvedSelection(resolved),
      ...(progress === undefined
        ? {}
        : { workflow: createAiqProgressRunSelection(progress, resolved.stages) }),
    };
  }
}

export async function runAiqMcpCheck(
  options: AiqMcpCheckOptions,
  adapterOptions?: AiqMcpServerOptions,
): Promise<AiqMcpCheckResult> {
  return new AiqMcpAdapter(adapterOptions).check(options);
}

export async function explainAiqMcpDiagnostics(
  options: AiqMcpExplainOptions,
  adapterOptions?: AiqMcpServerOptions,
): Promise<AiqMcpExplainResult> {
  return new AiqMcpAdapter(adapterOptions).explain(options);
}
