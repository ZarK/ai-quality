import type {
  AiqProgressRunSelection,
  AiqProgressStageIndex,
  AiqStageId,
  AiqWorkflowStage,
  LoadedAiqProgress,
} from "./types.js";
import { aiqProgressStageIndexes, aiqStageLadderIds } from "./types.js";

export function resolveAiqProgressStageIds(currentStage: AiqProgressStageIndex): AiqStageId[] {
  return [...aiqStageLadderIds.slice(0, currentStage + 1)];
}

export function resolveAiqProgressStageIndex(stageId: AiqStageId): number {
  const index = aiqStageLadderIds.indexOf(stageId);
  if (index < 0) {
    throw new Error(
      `Unknown AIQ stage id '${stageId}'. Expected one of ${aiqStageLadderIds.join(", ")}.`,
    );
  }

  return index;
}

export function toAiqWorkflowStage(index: number): AiqWorkflowStage {
  const id = aiqStageLadderIds[index];
  if (id === undefined) {
    throw new Error(`Unknown AIQ stage index: ${index}`);
  }

  return {
    id,
    index,
    name: id,
  };
}

export function createAiqProgressRunSelection(
  loadedProgress: LoadedAiqProgress,
  selectedStages: readonly AiqStageId[],
): AiqProgressRunSelection {
  const currentStage = toAiqWorkflowStage(loadedProgress.progress.current_stage);
  return {
    currentStage,
    defaultRun: {
      range: `0..${loadedProgress.progress.current_stage}`,
      stages: resolveAiqProgressStageIds(loadedProgress.progress.current_stage).map(
        (_stageId, index) => toAiqWorkflowStage(index),
      ),
    },
    progressPath: loadedProgress.path,
    progressSource: loadedProgress.source,
    selectedStages: [...selectedStages],
  };
}
