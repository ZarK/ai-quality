import type { readFile } from "node:fs/promises";

import type {
  AiqProfileName,
  AiqProgressRunSelection,
  ResolvedAiqConfig,
  RunPlan,
  RunResult,
  RunStageConfigurations,
  StageId,
  resolveAiqConfig,
  runEngine,
} from "@tjalve/aiq/api";
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
  workflow?: AiqProgressRunSelection;
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

export interface AiqMcpPlanResult {
  files: string[];
  plan: RunPlan;
  text: string;
  workflow?: AiqProgressRunSelection;
}

export interface AiqMcpStatusResult {
  cwd: string;
  profile: AiqProfileName;
  stages: StageId[];
  text: string;
  workflow?: AiqProgressRunSelection;
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

export const aiqStatusInputSchema = z.object({
  cwd: z.string().optional(),
});

export interface ResolvedMcpSelection {
  cwd: string;
  stages: StageId[];
  stageConfigurations?: RunStageConfigurations;
  profile: AiqProfileName;
  workflow?: AiqProgressRunSelection;
}
