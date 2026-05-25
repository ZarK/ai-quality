import { readFile } from "node:fs/promises";
import path from "node:path";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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
import { z } from "zod";

export interface AiqMcpServerOptions {
  cwd?: string;
  stages?: readonly StageId[];
  profile?: AiqProfileName;
  readFileImpl?: typeof readFile;
  resolveConfigImpl?: typeof resolveAiqConfig;
  runEngineImpl?: typeof runEngine;
  serverInfo?: {
    name: string;
    version: string;
  };
  writeArtifacts?: boolean;
}

export interface AiqMcpCheckOptions {
  cwd?: string;
  files: readonly string[];
  outDir?: string;
  stages?: readonly string[];
  profile?: string;
  signal?: AbortSignal;
}

export interface AiqMcpCheckResult {
  files: string[];
  ok: boolean;
  planPath?: string;
  report: RunResult;
  reportPath?: string;
  text: string;
}

export interface AiqMcpExplainOptions extends Omit<AiqMcpCheckOptions, "files"> {
  files?: readonly string[];
  reportPath?: string;
}

export interface AiqMcpExplainResult {
  diagnosticCount: number;
  report: RunResult;
  reportPath?: string;
  text: string;
}

export const aiqCheckFilesInputSchema = z.object({
  files: z.array(z.string()).min(1),
  outDir: z.string().optional(),
  stages: z.array(z.string()).optional(),
  profile: z.string().optional(),
});

export const aiqExplainDiagnosticsInputSchema = z
  .object({
    files: z.array(z.string()).optional(),
    outDir: z.string().optional(),
    stages: z.array(z.string()).optional(),
    profile: z.string().optional(),
    reportPath: z.string().trim().min(1).optional(),
  })
  .refine(
    (value) =>
      value.reportPath !== undefined || (value.files !== undefined && value.files.length > 0),
    {
      message: "Provide files or reportPath.",
      path: ["files"],
    },
  );

interface ResolvedMcpSelection {
  cwd: string;
  stages: StageId[];
  stageConfigurations?: RunStageConfigurations;
  profile: AiqProfileName;
}

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

  private async resolveSelection(
    cwd: string,
    options: Pick<AiqMcpCheckOptions, "stages" | "profile">,
  ): Promise<ResolvedMcpSelection> {
    const resolved = await this.resolveConfigImpl({
      cwd,
      ...(this.stages === undefined ? {} : { stages: [...this.stages] }),
      ...(this.profile === undefined ? {} : { profile: this.profile }),
      ...(options.stages === undefined
        ? {}
        : { stages: parseStageList(options.stages, "MCP stages") }),
      ...(options.profile === undefined
        ? {}
        : { profile: parseProfile(options.profile, "MCP profile") }),
      surface: "mcp",
    });

    return mapResolvedSelection(resolved);
  }
}

export function createAiqMcpServer(options: AiqMcpServerOptions = {}): McpServer {
  const server = new McpServer(options.serverInfo ?? { name: "aiq-mcp", version: "0.0.0" });
  const adapter = new AiqMcpAdapter(options);

  server.registerResource(
    "aiq-config",
    "aiq://config",
    {
      description: "Current AIQ MCP defaults and read-only behavior.",
      mimeType: "application/json",
      title: "AIQ Config",
    },
    async (uri) => ({
      contents: [
        {
          text: JSON.stringify(
            {
              cwd: path.resolve(options.cwd ?? process.cwd()),
              readOnlyDefault: true,
              toolNames: ["aiq_check_files", "aiq_explain_diagnostics"],
            },
            null,
            2,
          ),
          uri: uri.href,
        },
      ],
    }),
  );

  server.registerTool(
    "aiq_check_files",
    {
      description: "Run AIQ checks for explicit files without applying fixes.",
      inputSchema: aiqCheckFilesInputSchema,
    },
    async ({ files, outDir, stages, profile }) => {
      const result = await adapter.check({
        files,
        ...(outDir === undefined ? {} : { outDir }),
        ...(stages === undefined ? {} : { stages }),
        ...(profile === undefined ? {} : { profile }),
      });

      return {
        content: [{ text: result.text, type: "text" }],
        structuredContent: {
          diagnosticCount: result.report.summary.diagnosticCount,
          files: result.files,
          ok: result.ok,
          planPath: result.planPath,
          reportPath: result.reportPath,
          status: result.report.summary.status,
        },
      };
    },
  );

  server.registerTool(
    "aiq_explain_diagnostics",
    {
      description: "Explain AIQ diagnostics from a saved report or an explicit file check.",
      inputSchema: aiqExplainDiagnosticsInputSchema,
    },
    async ({ files, outDir, stages, profile, reportPath }) => {
      const result = await adapter.explain({
        ...(files === undefined ? {} : { files }),
        ...(outDir === undefined ? {} : { outDir }),
        ...(stages === undefined ? {} : { stages }),
        ...(profile === undefined ? {} : { profile }),
        ...(reportPath === undefined ? {} : { reportPath }),
      });

      return {
        content: [{ text: result.text, type: "text" }],
        structuredContent: {
          diagnosticCount: result.diagnosticCount,
          reportPath: result.reportPath,
          status: result.report.summary.status,
        },
      };
    },
  );

  return server;
}

export async function startAiqMcpStdioServer(options: AiqMcpServerOptions = {}): Promise<void> {
  const server = createAiqMcpServer(options);
  const transport = new StdioServerTransport();
  await server.connect(transport);
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

export function formatDiagnosticExplanation(report: RunResult): string {
  if (report.summary.diagnosticCount === 0) {
    return "AIQ found no diagnostics.";
  }

  const lines = [
    `AIQ diagnostics: ${report.summary.diagnosticCount}`,
    `Status: ${report.summary.status}`,
  ];

  for (const stage of report.stages) {
    if (stage.diagnostics.length === 0) {
      continue;
    }

    lines.push(`${stage.stageId}:`);
    for (const diagnostic of stage.diagnostics) {
      const location =
        diagnostic.range === undefined
          ? diagnostic.file
          : `${diagnostic.file}:${diagnostic.range.startLine}:${diagnostic.range.startColumn}`;
      lines.push(`- [${diagnostic.severity}] ${location} ${diagnostic.message}`);
    }
  }

  return lines.join("\n");
}

function assertExplainOptions(options: AiqMcpExplainOptions): void {
  if (normalizeOptionalString(options.reportPath) !== undefined) {
    return;
  }

  if (
    options.files !== undefined &&
    normalizeExplicitFiles(options.cwd ?? process.cwd(), options.files).length > 0
  ) {
    return;
  }

  throw new Error("Provide files or reportPath.");
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized === undefined || normalized.length === 0 ? undefined : normalized;
}

function mapResolvedSelection(resolved: ResolvedAiqConfig): ResolvedMcpSelection {
  return {
    cwd: resolved.cwd,
    stages: [...resolved.stages] as StageId[],
    ...(resolved.stageConfigurations === undefined
      ? {}
      : { stageConfigurations: resolved.stageConfigurations }),
    profile: resolved.profile,
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
