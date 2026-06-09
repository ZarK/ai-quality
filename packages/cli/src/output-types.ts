import type { formatBenchmarkReportAsJson } from "@tjalve/aiq/benchmark";
import type { RunResult, StageId } from "@tjalve/aiq/model";

import type { SetupGuidanceCommand } from "./types.js";

export interface ConfigCommandOutput {
  config: unknown;
  configPath?: string;
  progress: unknown;
  progressPath: string;
  progressSource: "defaults" | "file";
  profile: string;
  stages: string[];
}

export interface ConfigInitOutput {
  configCreated: boolean;
  configPath: string;
  progressCreated: boolean;
  progressPath: string;
}

export interface ConfigStageOutput {
  current_stage: number;
  progressPath: string;
}

export interface DoctorCheckOutput {
  detail?: string;
  install?: string;
  name: string;
  ok: boolean;
  required?: boolean;
  source?: "bundled" | "external" | "project";
}

export interface DoctorCommandOutput {
  checks: DoctorCheckOutput[];
  configPath?: string;
  cwd: string;
  detectedTech: string[];
  ok: boolean;
  progressPath: string;
  progressSource: "defaults" | "file";
  profile: string;
  stages: string[];
}

export interface FirstRunDetectionOutput {
  configCreated: boolean;
  configPath: string;
  detectedProjects: string[];
  progressCreated: boolean;
  progressPath: string;
  stages: string[];
  target: string;
  truncated: boolean;
  warnings: string[];
}

export interface FirstRunSetupOutput {
  cwd: string;
  examples: string[];
  markers: string[];
  remediation: string;
  summary: string;
}

export interface WorkflowStageOutput {
  id: StageId;
  index: number;
  name: string;
}

export interface RunWorkflowOutput {
  currentStage: WorkflowStageOutput;
  currentStageSatisfied?: boolean;
  debugCommands: string[];
  defaultRun: {
    range: string;
    stages: WorkflowStageOutput[];
  };
  failedStages: WorkflowStageOutput[];
  nextCommand: string;
  progressPath: string;
  progressSource: "defaults" | "file";
  selectedStages: StageId[];
}

export interface SetupGuidanceOutput {
  command: SetupGuidanceCommand;
  replacement: string;
  requested: string;
  summary: string;
}

export interface SetupCommandOutput {
  actions: Array<{
    detail: string;
    install?: string;
    name: string;
    required: boolean;
    source: "bundled" | "external" | "project";
    status: "available" | "missing" | "provided";
  }>;
  configPath?: string;
  cwd: string;
  detectedTech: string[];
  missingPrerequisites: DoctorCheckOutput[];
  nextCommands: string[];
  ok: boolean;
  progressPath: string;
  progressSource: "defaults" | "file";
  profile: string;
  stages: string[];
  summary: string;
}

export interface StatusCommandOutput {
  artifactPaths: {
    plan: string;
    report: string;
  };
  currentStage: WorkflowStageOutput;
  currentStageSatisfied?: boolean;
  defaultRun: {
    range: string;
    stages: WorkflowStageOutput[];
  };
  lastRun: {
    failedStages: WorkflowStageOutput[];
    finishedAt?: string;
    runId?: string;
    stages: Array<{
      stage: WorkflowStageOutput;
      status: "failed" | "not_implemented" | "passed";
    }>;
    status: "failed" | "none" | "not_implemented" | "passed" | "unreadable";
  };
  nextCommand: string;
  progressLastRun: string | null;
  progressPath: string;
  progressSource: "defaults" | "file";
  selectedStages: StageId[];
}

export type BenchmarkReport = Parameters<typeof formatBenchmarkReportAsJson>[0];

export interface WatchRunEnvelope {
  event: "run";
  result: RunResult;
  trigger: string;
  workflow?: RunWorkflowOutput;
}

export interface ServeListeningEnvelope {
  event: "listening";
  host: string;
  port: number;
  url: string;
}
