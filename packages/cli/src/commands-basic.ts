import { runBenchmarkSuite } from "@tjalve/aiq/benchmark";
import {
  initializeAiqProjectConfig,
  loadAiqProgress,
  resolveAiqConfig,
  setAiqProgressStage,
} from "@tjalve/aiq/config";
import { createRunPlan, writePlanArtifact } from "@tjalve/aiq/engine";
import type { RunRequest } from "@tjalve/aiq/model";

import { createAiqQualityEvidence, formatAiqQualityEvidenceJson } from "./evidence.js";
import {
  formatBenchmarkOutput,
  formatConfigInitOutput,
  formatConfigOutput,
  formatConfigStageOutput,
  formatPlanOutput,
  formatSetupGuidanceOutput,
} from "./output.js";
import { createRunRequest } from "./requests.js";
import { renderAiqCommandSchemaJson } from "./schema.js";
import { formatError } from "./shared.js";
import type { CliIo, ParsedArgs, SetupGuidanceCommand } from "./types.js";

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

export function runSetupGuidanceCommand(parsed: ParsedArgs, io: CliIo): number {
  const command = parsed.command as SetupGuidanceCommand;
  const output = createSetupGuidanceOutput(command, parsed.setupSubcommand);
  io.stdout.write(formatSetupGuidanceOutput(parsed.format, output));
  return 0;
}

export function runSchemaCommand(_parsed: ParsedArgs, io: CliIo): number {
  io.stdout.write(renderAiqCommandSchemaJson());
  return 0;
}

export async function runEvidenceCommand(_parsed: ParsedArgs, io: CliIo): Promise<number> {
  try {
    const evidence = await createAiqQualityEvidence(io.cwd);
    io.stdout.write(formatAiqQualityEvidenceJson(evidence));
    return 0;
  } catch (error) {
    io.stderr.write(`${formatError(error)}\n`);
    return 2;
  }
}

function createSetupGuidanceOutput(command: SetupGuidanceCommand, subcommand?: string) {
  switch (command) {
    case "hook":
      return {
        command,
        requested: `hook ${subcommand ?? ""}`.trim(),
        summary: "Hook setup uses the dedicated AIQ hook adapter.",
        replacement:
          "Use your repository hook manager to invoke the aiq-hook package, or run aiq check/run directly in pre-commit automation.",
      };
    case "ci":
      return {
        command,
        requested: `ci ${subcommand ?? ""}`.trim(),
        summary: "CI setup uses explicit workflow configuration.",
        replacement:
          "Use npx @tjalve/aiq run <files> in CI and keep stage/profile selection in .aiq/aiq.config.json.",
      };
    case "ignore":
      return {
        command,
        requested: `ignore ${subcommand ?? ""}`.trim(),
        summary: "Ignored inputs are configured in the canonical AIQ config file.",
        replacement:
          "Run aiq config to initialize .aiq/aiq.config.json, then edit inputs.ignore there so the ignored paths are reviewed with project config.",
      };
  }
}
