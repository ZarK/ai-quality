import path from "node:path";

import { type Plugin, tool } from "@opencode-ai/plugin";
import {
  type AiqProfileName,
  type ResolvedAiqConfig,
  aiqProfileNames,
  resolveAiqConfig,
} from "@tjalve/aiq-config-schema";
import { runEngine } from "@tjalve/aiq-engine";
import {
  type RunResult,
  type RunStageConfigurations,
  type StageId,
  stageIds,
} from "@tjalve/aiq-model";
import { formatRunResultAsText } from "@tjalve/aiq-reporters";

export interface AiqOpenCodeAdapterOptions {
  cwd?: string;
  stages?: readonly StageId[];
  profile?: AiqProfileName;
  resolveConfigImpl?: typeof resolveAiqConfig;
  runEngineImpl?: typeof runEngine;
  writeArtifacts?: boolean;
}

export interface AiqOpenCodeRunOptions {
  cwd?: string;
  files: readonly string[];
  outDir?: string;
  stages?: readonly string[];
  profile?: string;
  signal?: AbortSignal;
}

export interface AiqOpenCodeCheckResult {
  diagnostics: RunResult["stages"][number]["diagnostics"];
  files: string[];
  ok: boolean;
  planPath?: string;
  publishDiagnostics: boolean;
  report: RunResult;
  reportPath?: string;
  text: string;
}

export interface AiqOpenCodePluginContext {
  directory: string;
  worktree?: string | null;
}

export interface AiqOpenCodeToolContext {
  directory?: string;
  signal?: AbortSignal;
  worktree?: string | null;
}

interface ResolvedOpenCodeSelection {
  cwd: string;
  stages: StageId[];
  stageConfigurations?: RunStageConfigurations;
  profile: AiqProfileName;
  publishDiagnostics: boolean;
}

export class AiqOpenCodeAdapter {
  private readonly cwd: string;

  private readonly stages: readonly StageId[] | undefined;

  private readonly profile: AiqProfileName | undefined;

  private readonly resolveConfigImpl: typeof resolveAiqConfig;

  private readonly runEngineImpl: typeof runEngine;

  private readonly writeArtifacts: boolean;

  constructor(options: AiqOpenCodeAdapterOptions = {}) {
    this.cwd = path.resolve(options.cwd ?? process.cwd());
    this.stages = options.stages;
    this.profile = options.profile;
    this.resolveConfigImpl = options.resolveConfigImpl ?? resolveAiqConfig;
    this.runEngineImpl = options.runEngineImpl ?? runEngine;
    this.writeArtifacts = options.writeArtifacts ?? false;
  }

  async run(options: AiqOpenCodeRunOptions): Promise<AiqOpenCodeCheckResult> {
    const cwd = path.resolve(options.cwd ?? this.cwd);
    const files = normalizeExplicitFiles(cwd, options.files);
    if (files.length === 0) {
      throw new Error("OpenCode AIQ checks require at least one file.");
    }

    const selection = await this.resolveSelection(cwd, options);
    const report = await this.runEngineImpl({
      context: "opencode",
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

    const diagnostics = selection.publishDiagnostics
      ? report.stages.flatMap((stage) => stage.diagnostics)
      : [];

    return {
      diagnostics,
      files,
      ok: report.ok,
      ...(report.artifacts.planPath === undefined ? {} : { planPath: report.artifacts.planPath }),
      publishDiagnostics: selection.publishDiagnostics,
      report,
      ...(report.artifacts.reportPath === undefined
        ? {}
        : { reportPath: report.artifacts.reportPath }),
      text: formatAiqOpenCodeResult(report, selection.publishDiagnostics),
    };
  }

  private async resolveSelection(
    cwd: string,
    options: Pick<AiqOpenCodeRunOptions, "stages" | "profile">,
  ): Promise<ResolvedOpenCodeSelection> {
    const resolved = await this.resolveConfigImpl({
      cwd,
      ...(this.stages === undefined ? {} : { stages: [...this.stages] }),
      ...(this.profile === undefined ? {} : { profile: this.profile }),
      ...(options.stages === undefined
        ? {}
        : { stages: parseStageList(options.stages, "OpenCode stages") }),
      ...(options.profile === undefined
        ? {}
        : { profile: parseProfile(options.profile, "OpenCode profile") }),
      surface: "opencode",
    });

    return mapResolvedSelection(resolved);
  }
}

export async function runAiqOpenCodeCheck(
  options: AiqOpenCodeRunOptions,
  adapterOptions?: AiqOpenCodeAdapterOptions,
): Promise<AiqOpenCodeCheckResult> {
  return new AiqOpenCodeAdapter(adapterOptions).run(options);
}

export async function buildAiqOpenCodeHooks(
  context: AiqOpenCodePluginContext,
  options: AiqOpenCodeAdapterOptions = {},
): Promise<Awaited<ReturnType<Plugin>>> {
  const adapter = new AiqOpenCodeAdapter({
    ...options,
    cwd: context.worktree ?? context.directory,
  });

  return {
    tool: {
      aiq_check_files: tool({
        description: "Run AIQ checks for explicit files with read-only defaults.",
        args: {
          files: tool.schema.array(tool.schema.string()).min(1),
          outDir: tool.schema.string().optional(),
          stages: tool.schema.array(tool.schema.string()).optional(),
          profile: tool.schema.string().optional(),
        },
        async execute(
          args: { files: string[]; outDir?: string; stages?: string[]; profile?: string },
          toolContext: AiqOpenCodeToolContext,
        ) {
          const result = await adapter.run({
            cwd:
              toolContext.worktree ??
              toolContext.directory ??
              context.worktree ??
              context.directory,
            files: args.files,
            ...(args.outDir === undefined ? {} : { outDir: args.outDir }),
            ...(args.stages === undefined ? {} : { stages: args.stages }),
            ...(args.profile === undefined ? {} : { profile: args.profile }),
            ...(toolContext.signal === undefined ? {} : { signal: toolContext.signal }),
          });

          return result.text;
        },
      }),
    },
  };
}

export function createAiqOpenCodePlugin(options: AiqOpenCodeAdapterOptions = {}): Plugin {
  return async (context) =>
    buildAiqOpenCodeHooks(
      {
        directory: context.directory,
        ...(context.worktree === undefined ? {} : { worktree: context.worktree }),
      },
      options,
    );
}

export const AiqOpenCodePlugin: Plugin = createAiqOpenCodePlugin();

export function formatAiqOpenCodeResult(result: RunResult, publishDiagnostics: boolean): string {
  const base = formatRunResultAsText(result).trimEnd();
  if (publishDiagnostics) {
    return base;
  }

  return `${base}\nDiagnostics are hidden because surfaces.opencode.publishDiagnostics=false.`;
}

function mapResolvedSelection(resolved: ResolvedAiqConfig): ResolvedOpenCodeSelection {
  return {
    cwd: resolved.cwd,
    stages: [...resolved.stages] as StageId[],
    ...(resolved.stageConfigurations === undefined
      ? {}
      : { stageConfigurations: resolved.stageConfigurations }),
    profile: resolved.profile,
    publishDiagnostics: resolved.publishDiagnostics,
  };
}

function normalizeExplicitFiles(cwd: string, files: readonly string[]): string[] {
  const normalized = new Set<string>();

  for (const file of files.map((entry) => entry.trim()).filter((entry) => entry.length > 0)) {
    normalized.add(path.resolve(cwd, file));
  }

  return [...normalized].sort();
}

function parseStageList(values: readonly string[], label: string): StageId[] {
  const unique = new Set<StageId>();
  const stages: StageId[] = [];

  for (const value of values.map((entry) => entry.trim()).filter((entry) => entry.length > 0)) {
    if (!stageIds.includes(value as StageId)) {
      throw new Error(`${label} contains unsupported stage '${value}'.`);
    }

    const stage = value as StageId;
    if (!unique.has(stage)) {
      unique.add(stage);
      stages.push(stage);
    }
  }

  return stages;
}

function parseProfile(value: string, label: string): AiqProfileName {
  const normalized = value.trim();
  if (!aiqProfileNames.includes(normalized as AiqProfileName)) {
    throw new Error(`${label} must be one of ${aiqProfileNames.join(", ")}.`);
  }

  return normalized as AiqProfileName;
}
