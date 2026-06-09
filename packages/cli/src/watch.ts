import { watch as watchFileSystem } from "node:fs";

import { runResolvedRequest } from "@tjalve/aiq/engine";

import { writeWatchOutput } from "./output.js";
import {
  createActiveSignal,
  formatError,
  isCliCancellation,
  isErrorCode,
  readStdin,
  splitLines,
  waitForAbort,
} from "./shared.js";
import type { CliIo, CliRunOptions, ParsedArgs } from "./types.js";
import { createWatchPreparedRun } from "./watch-prepare.js";
import {
  matchesWatchTarget,
  resolveWatchTrigger,
  sameWatchPaths,
  sameWatchTargets,
  shouldReprepareWatchRun,
} from "./watch-targets.js";
import type { WatchDirectoryTarget, WatchPreparedRun } from "./watch-types.js";
import { createRunWorkflowForStages } from "./workflow.js";

type WatchRunKind = "cadence" | "continuous";

export async function runWatchCommand(
  parsed: ParsedArgs,
  io: CliIo,
  options: CliRunOptions,
): Promise<number> {
  const activeSignal = createActiveSignal(options.signal);
  const watchers: Array<ReturnType<typeof watchFileSystem>> = [];
  let cadenceTimer: ReturnType<typeof setInterval> | undefined;
  let cachedStreamFiles: string[] | undefined;
  let currentTargets: WatchDirectoryTarget[] = [];
  let currentReplanWatchPaths: string[] = [];
  let lastExitCode = 0;
  let cadenceRequested = false;
  let pendingContinuousTrigger: string | undefined;
  let prepared: WatchPreparedRun | undefined;
  let rerunRequested = false;
  let runInFlight = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const closeWatchers = (): void => {
    for (const watcher of watchers.splice(0)) {
      watcher.close();
    }
  };

  const clearPendingTimer = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  const clearCadenceTimer = (): void => {
    if (cadenceTimer !== undefined) {
      clearInterval(cadenceTimer);
      cadenceTimer = undefined;
    }
  };

  const updateWatchers = (targets: WatchDirectoryTarget[], replanWatchPaths: string[]): void => {
    closeWatchers();
    currentTargets = targets;
    currentReplanWatchPaths = replanWatchPaths;

    for (const target of targets) {
      try {
        watchers.push(
          watchFileSystem(target.dir, (_eventType, filename) => {
            if (!matchesWatchTarget(filename, target.names)) {
              return;
            }

            scheduleContinuousRun(resolveWatchTrigger(target.dir, filename, target.names));
          }),
        );
      } catch (error) {
        if (!isErrorCode(error, "ENOENT")) {
          throw error;
        }
      }
    }

    for (const replanWatchPath of replanWatchPaths) {
      try {
        watchers.push(
          watchFileSystem(replanWatchPath, () => {
            scheduleContinuousRun(replanWatchPath);
          }),
        );
      } catch (error) {
        if (!isErrorCode(error, "ENOENT")) {
          throw error;
        }
      }
    }
  };

  const updateCadenceTimer = (nextPrepared: WatchPreparedRun): void => {
    clearCadenceTimer();
    if (nextPrepared.cadence === undefined || nextPrepared.cadenceMs === undefined) {
      return;
    }

    cadenceTimer = setInterval(() => {
      cadenceRequested = true;
      if (!runInFlight && timer === undefined) {
        void executeNextRun();
      }
    }, nextPrepared.cadenceMs);
  };

  const ensurePrepared = async (trigger: string): Promise<WatchPreparedRun> => {
    if (prepared !== undefined && !shouldReprepareWatchRun(prepared, trigger)) {
      return prepared;
    }

    const nextPrepared = await createWatchPreparedRun(parsed, io, cachedStreamFiles);
    if (
      !sameWatchTargets(currentTargets, nextPrepared.targets) ||
      !sameWatchPaths(currentReplanWatchPaths, nextPrepared.replanWatchPaths)
    ) {
      updateWatchers(nextPrepared.targets, nextPrepared.replanWatchPaths);
    }
    updateCadenceTimer(nextPrepared);
    prepared = nextPrepared;
    return nextPrepared;
  };

  const executeNextRun = async (): Promise<void> => {
    if (activeSignal.signal.aborted || runInFlight) {
      return;
    }

    const runKind = resolveWatchRunKind(pendingContinuousTrigger, timer, cadenceRequested);
    if (runKind === undefined) {
      return;
    }

    runInFlight = true;
    const trigger = readWatchRunTrigger(runKind, pendingContinuousTrigger);
    pendingContinuousTrigger = runKind === "continuous" ? undefined : pendingContinuousTrigger;
    cadenceRequested = runKind === "cadence" ? false : cadenceRequested;

    try {
      cadenceRequested = await executePreparedWatchRun(runKind, trigger, cadenceRequested);
    } catch (error) {
      if (isCliCancellation(error, activeSignal.signal)) {
        return;
      }

      lastExitCode = 1;
      io.stderr.write(`${formatError(error)}\n`);
    } finally {
      runInFlight = false;
      finishWatchRun();
    }
  };

  const executePreparedWatchRun = async (
    runKind: WatchRunKind,
    trigger: string,
    currentCadenceRequested: boolean,
  ): Promise<boolean> => {
    const nextPrepared = await ensurePrepared(trigger);
    const execution = runKind === "continuous" ? nextPrepared.continuous : nextPrepared.cadence;
    if (execution === undefined) {
      lastExitCode = 0;
      return runKind === "continuous" && nextPrepared.cadence !== undefined
        ? true
        : currentCadenceRequested;
    }

    const result = await runResolvedRequest(
      {
        ...execution.request,
        signal: activeSignal.signal,
      },
      execution.plan,
    );
    lastExitCode = result.ok ? 0 : 1;
    writeWatchOutput(
      io,
      parsed.format,
      trigger,
      result,
      nextPrepared.progress === undefined
        ? undefined
        : createRunWorkflowForStages(
            nextPrepared.progress,
            execution.request.selection.stages,
            result,
          ),
    );
    return currentCadenceRequested;
  };

  const finishWatchRun = (): void => {
    if (activeSignal.signal.aborted) {
      return;
    }

    if (rerunRequested && pendingContinuousTrigger !== undefined) {
      rerunRequested = false;
      scheduleContinuousRun(pendingContinuousTrigger);
      return;
    }

    if (pendingContinuousTrigger !== undefined && timer === undefined) {
      void executeNextRun();
      return;
    }

    if (cadenceRequested) {
      void executeNextRun();
    }
  };

  const scheduleContinuousRun = (trigger: string): void => {
    const pendingTriggerRequiresReplan =
      prepared !== undefined &&
      pendingContinuousTrigger !== undefined &&
      shouldReprepareWatchRun(prepared, pendingContinuousTrigger);
    const nextTriggerRequiresReplan =
      prepared !== undefined && shouldReprepareWatchRun(prepared, trigger);

    if (!pendingTriggerRequiresReplan || nextTriggerRequiresReplan) {
      pendingContinuousTrigger = trigger;
    }

    if (activeSignal.signal.aborted) {
      return;
    }

    if (runInFlight) {
      rerunRequested = true;
      return;
    }

    clearPendingTimer();
    timer = setTimeout(() => {
      timer = undefined;
      void executeNextRun();
    }, parsed.debounceMs);
  };

  try {
    cachedStreamFiles = parsed.stdinFileList ? splitLines(await readStdin(io.stdin)) : undefined;
    const initialPrepared = await createWatchPreparedRun(parsed, io, cachedStreamFiles);
    prepared = initialPrepared;
    if (initialPrepared.continuous !== undefined) {
      pendingContinuousTrigger = "startup";
    } else if (initialPrepared.cadence !== undefined) {
      cadenceRequested = true;
    }
    await executeNextRun();
    updateWatchers(initialPrepared.targets, initialPrepared.replanWatchPaths);
    updateCadenceTimer(initialPrepared);
    await waitForAbort(activeSignal.signal);
    return lastExitCode;
  } catch (error) {
    if (isCliCancellation(error, activeSignal.signal)) {
      return 0;
    }

    io.stderr.write(`${formatError(error)}\n`);
    return 2;
  } finally {
    clearCadenceTimer();
    clearPendingTimer();
    closeWatchers();
    activeSignal.cleanup();
  }
}

function resolveWatchRunKind(
  pendingContinuousTrigger: string | undefined,
  timer: ReturnType<typeof setTimeout> | undefined,
  cadenceRequested: boolean,
): WatchRunKind | undefined {
  if (pendingContinuousTrigger !== undefined && timer === undefined) {
    return "continuous";
  }

  return cadenceRequested ? "cadence" : undefined;
}

function readWatchRunTrigger(
  runKind: WatchRunKind,
  pendingContinuousTrigger: string | undefined,
): string {
  return runKind === "continuous" ? (pendingContinuousTrigger ?? "startup") : "cadence";
}
