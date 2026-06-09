import type { LoadedAiqProgress } from "@tjalve/aiq/config";
import type { ResolvedRunRequest, RunPlan } from "@tjalve/aiq/model";

export interface WatchDirectoryTarget {
  dir: string;
  names: Set<string>;
}

export interface WatchPreparedRun {
  cadence?: PreparedWatchExecution;
  cadenceMs?: number;
  continuous?: PreparedWatchExecution;
  progress?: LoadedAiqProgress;
  replanPaths: Set<string>;
  replanWatchPaths: string[];
  targets: WatchDirectoryTarget[];
}

export interface PreparedWatchExecution {
  plan: RunPlan;
  request: ResolvedRunRequest;
}
