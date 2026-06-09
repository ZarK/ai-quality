import { initializeAiqProjectConfig, loadAiqProgress } from "@tjalve/aiq/config";
import { createRunPlan, runEngine } from "@tjalve/aiq/engine";
import type { RunRequest } from "@tjalve/aiq/model";

import {
  collectFirstRunManifestFiles,
  createFirstRunSetupGuidance,
  formatFirstRunDetectedProjects,
  inferFirstRunProjects,
  writeFirstRunJsonPrelude,
} from "./first-run.js";
import {
  formatDryRunOutput,
  formatFirstRunDetectionOutput,
  formatFirstRunResultDetails,
  formatFirstRunSetupOutput,
  formatRunResultOutput,
} from "./output.js";
import { createRunRequest } from "./requests.js";
import { formatError } from "./shared.js";
import type { CliIo, ParsedArgs } from "./types.js";
import { createRunWorkflowOutput } from "./workflow.js";

type FirstRunProjects = Awaited<ReturnType<typeof inferFirstRunProjects>>;
type FirstRunInitialization = Awaited<ReturnType<typeof initializeAiqProjectConfig>>;
type FirstRunManifestCollection = Awaited<ReturnType<typeof collectFirstRunManifestFiles>>;

interface FirstRunRequestContext {
  initialization: FirstRunInitialization;
  manifestCollection: FirstRunManifestCollection;
  projects: FirstRunProjects;
  request: RunRequest;
}

type FirstRunRequestContextResult = FirstRunRequestContext | "request-failed" | undefined;
type FirstRunReadiness = { code: number; context?: FirstRunRequestContext };

export async function runFirstRunCommand(parsed: ParsedArgs, io: CliIo): Promise<number> {
  const readiness = await prepareFirstRunCommand(parsed, io);
  if (readiness.context === undefined) {
    return readiness.code;
  }

  writeFirstRunDetection(parsed, io, readiness.context);
  return runPreparedFirstRun(parsed, io, readiness.context.request);
}

async function prepareFirstRunCommand(parsed: ParsedArgs, io: CliIo): Promise<FirstRunReadiness> {
  const projects = await inferFirstRunProjectsOrReport(io);
  if (projects === undefined) {
    return { code: 3 };
  }

  if (projects.length === 0) {
    io.stdout.write(formatFirstRunSetupOutput(parsed.format, createFirstRunSetupGuidance(io.cwd)));
    return { code: 2 };
  }

  const context = await createFirstRunRequestContext(parsed, io, projects);
  if (context === undefined) {
    return { code: 3 };
  }

  if (context === "request-failed") {
    return { code: 2 };
  }

  return { code: 0, context };
}

function writeFirstRunDetection(
  parsed: ParsedArgs,
  io: CliIo,
  context: FirstRunRequestContext,
): void {
  io.stdout.write(
    formatFirstRunDetectionOutput(parsed.format, {
      configCreated: context.initialization.configCreated,
      configPath: context.initialization.configPath,
      detectedProjects: formatFirstRunDetectedProjects(context.projects, io.cwd),
      progressCreated: context.initialization.progressCreated,
      progressPath: context.initialization.progressPath,
      stages: [...(context.request.stages ?? [])],
      target: ".",
      truncated: context.manifestCollection.truncated,
      warnings: context.manifestCollection.warnings,
    }),
  );
}

async function runPreparedFirstRun(
  parsed: ParsedArgs,
  io: CliIo,
  request: RunRequest,
): Promise<number> {
  try {
    if (parsed.dryRun) {
      request.writeArtifacts = false;
      const plan = await createRunPlan(request);
      io.stdout.write(formatDryRunOutput(parsed.format, plan));
      return 0;
    }

    const result = await runEngine(request);
    io.stdout.write(
      writeFirstRunJsonPrelude(parsed.format)
        ? formatRunResultOutput(parsed.format, result)
        : formatRunResultOutput(parsed.format, result, "run", { verbose: parsed.verbose }),
    );
    if (parsed.format === "text") {
      io.stdout.write(formatFirstRunResultDetails(result));
    }
    return result.ok ? 0 : 1;
  } catch (error) {
    io.stderr.write(`${formatError(error)}\n`);
    return 3;
  }
}

async function inferFirstRunProjectsOrReport(io: CliIo): Promise<FirstRunProjects | undefined> {
  try {
    return await inferFirstRunProjects(io.cwd);
  } catch (error) {
    io.stderr.write(`${formatError(error)}\n`);
    return undefined;
  }
}

async function createFirstRunRequestContext(
  parsed: ParsedArgs,
  io: CliIo,
  projects: FirstRunProjects,
): Promise<FirstRunRequestContextResult> {
  let initialization: FirstRunInitialization;
  try {
    initialization = await initializeAiqProjectConfig(io.cwd);
  } catch (error) {
    io.stderr.write(`${formatError(error)}\n`);
    return undefined;
  }

  try {
    const manifestCollection = await collectFirstRunManifestFiles(io.cwd, projects);
    const request = await createFirstRunRunRequest(parsed, io, initialization, manifestCollection);
    return { initialization, manifestCollection, projects, request };
  } catch (error) {
    io.stderr.write(`${formatError(error)}\n`);
    return "request-failed";
  }
}

async function createFirstRunRunRequest(
  parsed: ParsedArgs,
  io: CliIo,
  initialization: FirstRunInitialization,
  manifestCollection: FirstRunManifestCollection,
): Promise<RunRequest> {
  const firstRunParsed: ParsedArgs = {
    ...parsed,
    command: "run",
    files: manifestCollection.files,
  };
  return createRunRequest(firstRunParsed, io, {
    context: "cli",
    includeProgressStage: !initialization.progressCreated,
    mode: "check",
    surface: "cli",
  });
}

export async function runCheckCommand(parsed: ParsedArgs, io: CliIo): Promise<number> {
  const outputCommand = parsed.command === "run" ? "run" : "check";
  let request: RunRequest;
  let loadedProgress: Awaited<ReturnType<typeof loadAiqProgress>> | undefined;
  try {
    request = await createRunRequest(parsed, io, {
      context: "cli",
      includeProgressStage: true,
      mode: "check",
      surface: "cli",
    });
    loadedProgress = await loadOptionalRunProgress(parsed, io);
  } catch (error) {
    io.stderr.write(`${formatError(error)}\n`);
    return 2;
  }

  try {
    if (parsed.dryRun) {
      request.writeArtifacts = false;
      const plan = await createRunPlan(request);
      io.stdout.write(formatDryRunOutput(parsed.format, plan));
      return 0;
    }

    const result = await runEngine(request);
    io.stdout.write(
      formatRunResultOutput(parsed.format, result, outputCommand, {
        verbose: parsed.verbose,
        ...(loadedProgress === undefined
          ? {}
          : { workflow: createRunWorkflowOutput(loadedProgress, request, result) }),
      }),
    );
    return result.ok ? 0 : 1;
  } catch (error) {
    io.stderr.write(`${formatError(error)}\n`);
    return 1;
  }
}

async function loadOptionalRunProgress(
  parsed: ParsedArgs,
  io: CliIo,
): Promise<Awaited<ReturnType<typeof loadAiqProgress>> | undefined> {
  try {
    return await loadAiqProgress(io.cwd);
  } catch (error) {
    if (parsed.stages.length > 0 || parsed.profile !== undefined) {
      return undefined;
    }

    throw error;
  }
}
