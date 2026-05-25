import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { runBenchmarkSuite } from "@tjalve/aiq-benchmark";
import {
  initializeAiqProjectConfig,
  loadAiqProgress,
  resolveAiqConfig,
  setAiqProgressStage,
} from "@tjalve/aiq-config-schema";
import { createRunPlan, runEngine, writePlanArtifact } from "@tjalve/aiq-engine";
import type { RunRequest } from "@tjalve/aiq-model";

import {
  collectFirstRunManifestFiles,
  createFirstRunSetupGuidance,
  formatFirstRunDetectedProjects,
  inferFirstRunProjects,
  writeFirstRunJsonPrelude,
} from "./first-run.js";
import {
  formatBenchmarkOutput,
  formatConfigInitOutput,
  formatConfigOutput,
  formatConfigStageOutput,
  formatDoctorOutput,
  formatDryRunOutput,
  formatFirstRunDetectionOutput,
  formatFirstRunResultDetails,
  formatFirstRunSetupOutput,
  formatPlanOutput,
  formatRunResultOutput,
  formatSetupGuidanceOutput,
} from "./output.js";
import { createRunRequest } from "./requests.js";
import { formatError } from "./shared.js";
import type { CliIo, ParsedArgs, SetupGuidanceCommand } from "./types.js";

const execFileAsync = promisify(execFile);

const doctorPrerequisites = [
  {
    binaries: ["node"],
    required: true,
    name: "Node.js runtime",
  },
  {
    binaries: ["npm"],
    required: false,
    name: "npm package manager",
  },
  {
    binaries: ["git"],
    required: false,
    name: "Git",
  },
  {
    binaries: ["python3", "python"],
    required: false,
    name: "Python runtime",
  },
  {
    binaries: ["go"],
    required: false,
    name: "Go toolchain",
  },
  {
    binaries: ["cargo"],
    required: false,
    name: "Rust Cargo",
  },
  {
    binaries: ["dotnet"],
    required: false,
    name: ".NET SDK",
  },
  {
    binaries: ["java"],
    required: false,
    name: "JVM runtime",
  },
] as const;

export async function runBenchCommand(parsed: ParsedArgs, io: CliIo): Promise<number> {
  try {
    const { report } = await runBenchmarkSuite({
      ...(parsed.benchmarkCorpusRoot === undefined
        ? {}
        : { corpusRoot: parsed.benchmarkCorpusRoot }),
      cwd: io.cwd,
      ...(parsed.benchmarkKinds.length === 0 ? {} : { kinds: parsed.benchmarkKinds }),
      ...(parsed.outDir === undefined ? {} : { outDir: parsed.outDir }),
      ...(parsed.benchmarkScenarioIds.length === 0
        ? {}
        : { scenarioIds: parsed.benchmarkScenarioIds }),
      ...(parsed.benchmarkTags.length === 0 ? {} : { tags: parsed.benchmarkTags }),
    });
    io.stdout.write(formatBenchmarkOutput(parsed.format, report));
    return report.summary.failedBudgetCount === 0 ? 0 : 1;
  } catch (error) {
    io.stderr.write(`${formatError(error)}\n`);
    return 1;
  }
}

export async function runConfigCommand(parsed: ParsedArgs, io: CliIo): Promise<number> {
  try {
    if (parsed.configSetStage !== undefined) {
      const progress = await setAiqProgressStage(io.cwd, parsed.configSetStage);
      io.stdout.write(
        formatConfigStageOutput(parsed.format, {
          current_stage: progress.progress.current_stage,
          progressPath: progress.path,
        }),
      );
      return 0;
    }

    if (parsed.configPrint) {
      const [resolvedConfig, loadedProgress] = await Promise.all([
        resolveAiqConfig({ cwd: io.cwd, surface: "cli" }),
        loadAiqProgress(io.cwd),
      ]);
      io.stdout.write(
        formatConfigOutput(parsed.format, {
          config: resolvedConfig.config,
          ...(resolvedConfig.configPath === undefined
            ? {}
            : { configPath: resolvedConfig.configPath }),
          progress: loadedProgress.progress,
          progressPath: loadedProgress.path,
          progressSource: loadedProgress.source,
          profile: resolvedConfig.profile,
          stages: resolvedConfig.stages,
        }),
      );
      return 0;
    }

    const result = await initializeAiqProjectConfig(io.cwd);
    io.stdout.write(formatConfigInitOutput(parsed.format, result));
    return 0;
  } catch (error) {
    io.stderr.write(`${formatError(error)}\n`);
    return 2;
  }
}

export async function runPlanCommand(parsed: ParsedArgs, io: CliIo): Promise<number> {
  let request: RunRequest;
  try {
    request = await createRunRequest(parsed, io, {
      context: "cli",
      includeProgressStage: true,
      mode: "plan",
      surface: "cli",
    });
  } catch (error) {
    io.stderr.write(`${formatError(error)}\n`);
    return 2;
  }

  try {
    const plan = await createRunPlan(request);
    if (request.writeArtifacts !== false) {
      await writePlanArtifact(plan, plan.artifacts.outDir);
    }
    io.stdout.write(formatPlanOutput(parsed.format, plan));
    return 0;
  } catch (error) {
    io.stderr.write(`${formatError(error)}\n`);
    return 1;
  }
}

export async function runDoctorCommand(parsed: ParsedArgs, io: CliIo): Promise<number> {
  try {
    const [resolvedConfig, loadedProgress, prerequisiteChecks] = await Promise.all([
      resolveAiqConfig({ cwd: io.cwd, surface: "cli" }),
      loadAiqProgress(io.cwd),
      Promise.all(
        doctorPrerequisites.map(async (prerequisite) => ({
          detail: await resolveInstalledCommand(prerequisite.binaries),
          name: prerequisite.name,
          required: prerequisite.required,
        })),
      ),
    ]);
    const checks = [
      {
        detail: resolvedConfig.configPath ?? "using built-in defaults",
        name: "Config is valid",
        ok: true,
      },
      {
        detail: `${loadedProgress.path} (${loadedProgress.source})`,
        name: "Progress state is valid",
        ok: true,
      },
      ...prerequisiteChecks.map((check) => ({
        detail:
          check.detail ??
          (check.required
            ? "not detected; install this required CLI runtime prerequisite"
            : "not detected; install it if selected stages require it"),
        name: check.name,
        ok: check.detail !== undefined || !check.required,
        required: check.required,
      })),
    ];
    io.stdout.write(
      formatDoctorOutput(parsed.format, {
        checks,
        ...(resolvedConfig.configPath === undefined
          ? {}
          : { configPath: resolvedConfig.configPath }),
        cwd: resolvedConfig.cwd,
        ok: checks.every((check) => check.ok),
        progressPath: loadedProgress.path,
        progressSource: loadedProgress.source,
        profile: resolvedConfig.profile,
        stages: resolvedConfig.stages,
      }),
    );
    return checks.every((check) => check.ok) ? 0 : 1;
  } catch (error) {
    io.stderr.write(`${formatError(error)}\n`);
    return 2;
  }
}

export function runSetupGuidanceCommand(parsed: ParsedArgs, io: CliIo): number {
  const command = parsed.command as SetupGuidanceCommand;
  const output = createSetupGuidanceOutput(command, parsed.setupSubcommand);
  io.stdout.write(formatSetupGuidanceOutput(parsed.format, output));
  return 0;
}

export async function runFirstRunCommand(parsed: ParsedArgs, io: CliIo): Promise<number> {
  let projects: Awaited<ReturnType<typeof inferFirstRunProjects>>;
  try {
    projects = await inferFirstRunProjects(io.cwd);
  } catch (error) {
    io.stderr.write(`${formatError(error)}\n`);
    return 3;
  }

  if (projects.length === 0) {
    io.stdout.write(formatFirstRunSetupOutput(parsed.format, createFirstRunSetupGuidance(io.cwd)));
    return 2;
  }

  let initialization: Awaited<ReturnType<typeof initializeAiqProjectConfig>>;
  let request: RunRequest;
  try {
    initialization = await initializeAiqProjectConfig(io.cwd);
  } catch (error) {
    io.stderr.write(`${formatError(error)}\n`);
    return 3;
  }

  let manifestCollection: Awaited<ReturnType<typeof collectFirstRunManifestFiles>>;
  try {
    manifestCollection = await collectFirstRunManifestFiles(io.cwd, projects);
    const firstRunParsed: ParsedArgs = {
      ...parsed,
      command: "run",
      files: manifestCollection.files,
    };
    request = await createRunRequest(firstRunParsed, io, {
      context: "cli",
      includeProgressStage: !initialization.progressCreated,
      mode: "check",
      surface: "cli",
    });
  } catch (error) {
    io.stderr.write(`${formatError(error)}\n`);
    return 2;
  }

  io.stdout.write(
    formatFirstRunDetectionOutput(parsed.format, {
      configCreated: initialization.configCreated,
      configPath: initialization.configPath,
      detectedProjects: formatFirstRunDetectedProjects(projects, io.cwd),
      progressCreated: initialization.progressCreated,
      progressPath: initialization.progressPath,
      stages: [...(request.stages ?? [])],
      target: ".",
      truncated: manifestCollection.truncated,
      warnings: manifestCollection.warnings,
    }),
  );

  try {
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

export async function runCheckCommand(parsed: ParsedArgs, io: CliIo): Promise<number> {
  const outputCommand = parsed.command === "run" ? "run" : "check";
  let request: RunRequest;
  try {
    request = await createRunRequest(parsed, io, {
      context: "cli",
      includeProgressStage: true,
      mode: "check",
      surface: "cli",
    });
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
      formatRunResultOutput(parsed.format, result, outputCommand, { verbose: parsed.verbose }),
    );
    return result.ok ? 0 : 1;
  } catch (error) {
    io.stderr.write(`${formatError(error)}\n`);
    return 1;
  }
}

async function resolveInstalledCommand(
  commandNames: readonly string[],
): Promise<string | undefined> {
  for (const commandName of commandNames) {
    if (commandName === "node") {
      return process.execPath;
    }

    const result = await runCommand(process.platform === "win32" ? "where" : "which", [
      commandName,
    ]);
    if (result.exitCode === 0) {
      const resolved = result.stdout
        .split(/\r?\n/u)
        .map((value) => value.trim())
        .find((value) => value.length > 0);
      return resolved ?? commandName;
    }
  }

  return undefined;
}

async function runCommand(
  command: string,
  args: string[],
): Promise<{ exitCode: number; stdout: string }> {
  try {
    const result = await execFileAsync(command, args, {
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    });
    return { exitCode: 0, stdout: result.stdout };
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error) {
      const code = (error as { code?: unknown }).code;
      const stdout = (error as { stdout?: unknown }).stdout;
      return {
        exitCode: typeof code === "number" ? code : 1,
        stdout: typeof stdout === "string" ? stdout : "",
      };
    }

    return { exitCode: 1, stdout: "" };
  }
}

function createSetupGuidanceOutput(command: SetupGuidanceCommand, subcommand?: string) {
  switch (command) {
    case "install-tools":
      return {
        command,
        requested: "install-tools",
        summary: "Global tool installation is intentionally not part of the rewrite CLI.",
        replacement:
          "Run aiq doctor to see missing runtime prerequisites, then install the language tools your selected stages require through your normal project/package manager.",
      };
    case "hook":
      return {
        command,
        requested: `hook ${subcommand ?? ""}`.trim(),
        summary:
          "Hook installation is handled by the dedicated AIQ hook adapter, not by a mutating CLI command.",
        replacement:
          "Use your repository hook manager to invoke the aiq-hook package, or run aiq check/run directly in pre-commit automation.",
      };
    case "ci":
      return {
        command,
        requested: `ci ${subcommand ?? ""}`.trim(),
        summary: "CI setup generation is replaced by explicit workflow configuration.",
        replacement:
          "Use npx @tjalve/aiq run <files> in CI and keep stage/profile selection in .aiq/aiq.config.json.",
      };
    case "ignore":
      return {
        command,
        requested: `ignore ${subcommand ?? ""}`.trim(),
        summary: "Ignore-file mutation is replaced by the canonical AIQ config file.",
        replacement:
          "Run aiq config to initialize .aiq/aiq.config.json, then edit inputs.ignore there so the ignored paths are reviewed with project config.",
      };
  }
}
