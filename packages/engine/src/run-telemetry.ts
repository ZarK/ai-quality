import type {
  ResolvedRunRequest,
  RunTelemetryEvent,
  RunTelemetryEventType,
  StageResult,
} from "./contracts.js";
import { artifactSchemaVersion } from "./contracts.js";

export function createTelemetryEvent(
  request: Pick<ResolvedRunRequest, "context" | "selection">,
  runId: string,
  event: RunTelemetryEventType,
  timestamp: Date,
  details: Omit<
    Partial<RunTelemetryEvent>,
    "artifactType" | "artifactVersion" | "context" | "event" | "profile" | "runId" | "timestamp"
  > = {},
): RunTelemetryEvent {
  return {
    artifactType: "metrics-event",
    artifactVersion: artifactSchemaVersion,
    context: request.context,
    event,
    profile: request.selection.profile,
    runId,
    timestamp: timestamp.toISOString(),
    ...details,
  };
}

export function emitStageTelemetry(
  request: Pick<ResolvedRunRequest, "writeArtifacts">,
  emitTelemetry: (
    event: RunTelemetryEventType,
    timestamp: Date,
    details?: Omit<
      Partial<RunTelemetryEvent>,
      "artifactType" | "artifactVersion" | "context" | "event" | "profile" | "runId" | "timestamp"
    >,
  ) => void,
  stage: StageResult,
): void {
  if (!request.writeArtifacts) {
    return;
  }

  const stageFinished = new Date();
  for (const toolRun of stage.toolRuns) {
    const toolFinishedAt =
      toolRun.finishedAt === undefined ? stageFinished : new Date(toolRun.finishedAt);
    emitTelemetry(toolRun.cacheHit ? "cache.hit" : "cache.miss", toolFinishedAt, {
      cacheHit: toolRun.cacheHit,
      durationMs: toolRun.durationMs,
      stageId: stage.stageId,
      tool: toolRun.tool,
    });
    emitTelemetry("tool.finished", toolFinishedAt, {
      cacheHit: toolRun.cacheHit,
      durationMs: toolRun.durationMs,
      stageId: stage.stageId,
      status: toolRun.status,
      tool: toolRun.tool,
    });
  }

  emitTelemetry("stage.finished", stageFinished, {
    diagnosticCount: stage.diagnostics.length,
    durationMs: stage.durationMs,
    stageId: stage.stageId,
    status: stage.status,
    toolRunCount: stage.toolRuns.length,
  });
}
