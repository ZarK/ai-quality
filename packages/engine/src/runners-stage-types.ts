import type { PlannedTask, StageId, StageResult } from "./contracts.js";

export type RunnerStageExecutionContext = {
  cwd: string;
  signal: AbortSignal | undefined;
};

export type RunnerStageHandler = (
  task: PlannedTask,
  context: RunnerStageExecutionContext,
) => Promise<StageResult>;

export type RunnerResolvedStageHandler = {
  files: string[];
  handler: RunnerStageHandler;
};

export type RunnerLanguageModule = {
  id: string;
  stageHandlers: Partial<Record<StageId, RunnerStageHandler>>;
};

export type RunnerStageDefinition = {
  aggregation: "combine" | "not_implemented";
  id: StageId;
  moduleIds: readonly string[];
  note?: string;
  scope: "language-modules" | "stage-only";
};
