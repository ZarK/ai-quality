import { loadAiqProgress } from "@tjalve/aiq/config";

import { detectProjectLanguages, formatDetectedLanguages } from "./doctor-detect.js";
import {
  mergeDoctorPrerequisites,
  resolveDoctorBundledTools,
  resolveDoctorToolRequirements,
  resolveInstalledCommand,
  validateDoctorPrerequisiteVersion,
} from "./doctor-requirements.js";
import { doctorPrerequisites } from "./doctor-types.js";
import { detectNativeConfigs, resolveDoctorNativeConfigChecks } from "./native-config.js";
import type { DoctorCheckOutput, DoctorCommandOutput, SetupCommandOutput } from "./output.js";
import { resolveCliConfig } from "./requests.js";
import type { CliIo, ParsedArgs } from "./types.js";

export async function createDoctorCommandOutput(
  parsed: ParsedArgs,
  io: CliIo,
): Promise<DoctorCommandOutput> {
  const [resolvedConfig, loadedProgress, detectedLanguages, nativeConfigs] = await Promise.all([
    resolveCliConfig(parsed, io, {
      includeProgressStage: true,
      surface: "cli",
    }),
    loadAiqProgress(io.cwd),
    detectProjectLanguages(io.cwd),
    detectNativeConfigs(io.cwd),
  ]);
  const externalRequirements = resolveDoctorToolRequirements(
    detectedLanguages,
    resolvedConfig.stages,
  );
  const prerequisites = mergeDoctorPrerequisites(doctorPrerequisites, externalRequirements);
  const prerequisiteChecks = await Promise.all(
    prerequisites.map(async (prerequisite) => {
      const installed = await resolveInstalledCommand(prerequisite.binaries, {
        includeVersion: parsed.verbose,
      });
      const versionProblem =
        installed === undefined ? undefined : validateDoctorPrerequisiteVersion(prerequisite);
      return {
        detail: versionProblem ?? installed ?? `not detected; ${prerequisite.install}`,
        install: prerequisite.install,
        name: prerequisite.name,
        ok: installed !== undefined && versionProblem === undefined ? true : !prerequisite.required,
        required: prerequisite.required,
        source: "source" in prerequisite ? prerequisite.source : "external",
      };
    }),
  );
  const bundledChecks = resolveDoctorBundledTools(detectedLanguages, resolvedConfig.stages).map(
    (tool) => ({
      detail: tool.detail,
      name: tool.name,
      ok: true,
      required: false,
      source: tool.source,
    }),
  );
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
    ...resolveDoctorNativeConfigChecks(detectedLanguages, resolvedConfig.stages, nativeConfigs),
    ...prerequisiteChecks,
    ...bundledChecks,
  ];

  return {
    checks,
    ...(resolvedConfig.configPath === undefined ? {} : { configPath: resolvedConfig.configPath }),
    cwd: resolvedConfig.cwd,
    detectedTech: formatDetectedLanguages(detectedLanguages),
    ok: checks.every((check) => check.ok),
    progressPath: loadedProgress.path,
    progressSource: loadedProgress.source,
    profile: resolvedConfig.profile,
    stages: resolvedConfig.stages,
  };
}

export function createSetupCommandOutput(
  doctorOutput: DoctorCommandOutput,
  parsed: ParsedArgs,
): SetupCommandOutput {
  const toolChecks = doctorOutput.checks.filter(isToolSetupCheck);
  const missingPrerequisites = toolChecks.filter((check) => check.required && !check.ok);
  const stageFlags = formatStageSelectionFlags(parsed);
  const doctorCommand =
    stageFlags.length === 0 ? "aiq doctor" : `aiq doctor ${stageFlags.join(" ")}`;
  const rerunCommand = stageFlags.length === 0 ? "aiq" : `aiq ${stageFlags.join(" ")}`;
  return {
    actions: toolChecks.map((check) => ({
      detail: check.detail ?? "",
      ...(check.install === undefined ? {} : { install: check.install }),
      name: check.name,
      required: check.required === true,
      source: check.source ?? "external",
      status: resolveSetupActionStatus(check),
    })),
    ...(doctorOutput.configPath === undefined ? {} : { configPath: doctorOutput.configPath }),
    cwd: doctorOutput.cwd,
    detectedTech: doctorOutput.detectedTech,
    missingPrerequisites,
    nextCommands:
      missingPrerequisites.length === 0
        ? [rerunCommand]
        : [
            "Install missing required tools through the normal language, project, or host toolchain.",
            doctorCommand,
            rerunCommand,
          ],
    ok: missingPrerequisites.length === 0,
    progressPath: doctorOutput.progressPath,
    progressSource: doctorOutput.progressSource,
    profile: doctorOutput.profile,
    stages: doctorOutput.stages,
    summary:
      missingPrerequisites.length === 0
        ? "Selected AIQ stages have no missing required setup."
        : "Selected AIQ stages need required setup before the agent can run them.",
  };
}

function isToolSetupCheck(
  check: DoctorCheckOutput,
): check is DoctorCheckOutput & { source: "bundled" | "external" | "project" } {
  return check.source === "bundled" || check.source === "external" || check.source === "project";
}

function resolveSetupActionStatus(
  check: DoctorCheckOutput & { source: "bundled" | "external" | "project" },
): SetupCommandOutput["actions"][number]["status"] {
  if (!check.ok && check.required === true) {
    return "missing";
  }

  if (check.source === "bundled" || check.source === "project") {
    return "provided";
  }

  return check.detail?.startsWith("not detected") ? "missing" : check.ok ? "available" : "missing";
}

function formatStageSelectionFlags(parsed: ParsedArgs): string[] {
  if (parsed.stages.length === 0) {
    return parsed.profile === undefined ? [] : ["--profile", parsed.profile];
  }

  return parsed.stages.flatMap((stage) => ["--stage", stage]);
}
