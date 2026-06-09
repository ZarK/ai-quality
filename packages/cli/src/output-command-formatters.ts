import type {
  ConfigCommandOutput,
  ConfigInitOutput,
  ConfigStageOutput,
  DoctorCheckOutput,
  DoctorCommandOutput,
  FirstRunDetectionOutput,
  FirstRunSetupOutput,
  SetupCommandOutput,
  SetupGuidanceOutput,
  StatusCommandOutput,
} from "./output-types.js";
import {
  formatProgressStage,
  formatStatusLastRun,
  formatWorkflowStage,
} from "./output-workflow.js";
import type { OutputFormat } from "./types.js";

export function formatDoctorOutput(format: OutputFormat, output: DoctorCommandOutput): string {
  if (format === "json") {
    return `${JSON.stringify(output, null, 2)}\n`;
  }

  return [
    "AIQ doctor",
    `Config: ${output.configPath ?? "defaults"}`,
    `Progress: ${output.progressPath} (${output.progressSource})`,
    `Profile: ${output.profile}`,
    `Stages: ${output.stages.join(", ")}`,
    `Technologies: ${output.detectedTech.length === 0 ? "none detected" : output.detectedTech.join(", ")}`,
    ...output.checks.map(
      (check) =>
        `${formatDoctorCheckStatus(check)} ${check.name}${check.detail === undefined ? "" : ` - ${check.detail}`}`,
    ),
    `Status: ${output.ok ? "passed" : "failed"}`,
    "",
  ].join("\n");
}

export function formatSetupOutput(format: OutputFormat, output: SetupCommandOutput): string {
  if (format === "json") {
    return `${JSON.stringify(output, null, 2)}\n`;
  }

  const missing = output.missingPrerequisites;
  return [
    "AIQ setup",
    output.summary,
    `Config: ${output.configPath ?? "defaults"}`,
    `Progress: ${output.progressPath} (${output.progressSource})`,
    `Profile: ${output.profile}`,
    `Stages: ${output.stages.join(", ")}`,
    `Technologies: ${output.detectedTech.length === 0 ? "none detected" : output.detectedTech.join(", ")}`,
    missing.length === 0 ? "Required setup: none missing" : "Required setup:",
    ...missing.map(
      (check) =>
        `  - ${check.name}: ${check.install ?? check.detail ?? "install through the normal project toolchain"}`,
    ),
    "Tool sources:",
    ...output.actions.map((action) => {
      const label =
        action.status === "missing"
          ? "missing"
          : action.source === "bundled"
            ? "bundled"
            : action.source === "project"
              ? "project"
              : "available";
      return `  - ${action.name}: ${label} - ${action.detail}`;
    }),
    "Next:",
    ...output.nextCommands.map((command) => `  - ${command}`),
    "AIQ reports setup needs; it does not install tools or mutate the host environment.",
    "",
  ].join("\n");
}

export function formatStatusOutput(format: OutputFormat, output: StatusCommandOutput): string {
  if (format === "json") {
    return `${JSON.stringify(output, null, 2)}\n`;
  }

  return [
    "AIQ status",
    `Current stage: ${formatWorkflowStage(output.currentStage)}`,
    `Progress: ${output.progressPath} (${output.progressSource})`,
    `Default run: stages ${output.defaultRun.range} (${output.defaultRun.stages.map((stage) => stage.id).join(", ")})`,
    `Selected stages: ${output.selectedStages.length === 0 ? "none configured yet" : output.selectedStages.join(", ")}`,
    formatStatusLastRun(output.lastRun),
    output.currentStageSatisfied === undefined
      ? undefined
      : `Current stage satisfied: ${output.currentStageSatisfied ? "yes" : "no"}`,
    `Artifacts: plan=${output.artifactPaths.plan}, report=${output.artifactPaths.report}`,
    output.lastRun.failedStages.length === 0
      ? undefined
      : `Failed stages: ${output.lastRun.failedStages.map(formatWorkflowStage).join(", ")}`,
    `Next: ${output.nextCommand}`,
    "",
  ]
    .filter((line): line is string => line !== undefined)
    .join("\n");
}

export function formatFirstRunDetectionOutput(
  format: OutputFormat,
  output: FirstRunDetectionOutput,
): string {
  if (format === "json") {
    return `${JSON.stringify({ firstRun: output }, null, 2)}\n`;
  }

  return [
    "AIQ first run",
    `Detected project: ${output.detectedProjects.join(", ")}`,
    `Target: ${output.target}`,
    `Stages: ${output.stages.join(", ")}`,
    `${output.configCreated ? "Wrote" : "Found"} config: ${output.configPath}`,
    `${output.progressCreated ? "Wrote" : "Found"} progress: ${output.progressPath}`,
    ...(output.truncated
      ? [
          "Warning: first-run input collection reached its safety limit; pass explicit files or configure inputs.ignore for full control.",
        ]
      : []),
    ...output.warnings.map((warning) => `Warning: ${warning}`),
    "Change stage: aiq config --set-stage <0-9>",
    "Prepare missing tools/config: aiq setup",
    "Run a specific path: aiq run <files...>",
    "",
  ].join("\n");
}

export function formatFirstRunSetupOutput(
  format: OutputFormat,
  output: FirstRunSetupOutput,
): string {
  if (format === "json") {
    return `${JSON.stringify({ firstRun: output }, null, 2)}\n`;
  }

  return [
    "AIQ first run",
    output.summary,
    `Current directory: ${output.cwd}`,
    output.remediation,
    `Supported markers: ${output.markers.join(", ")}`,
    "Examples:",
    ...output.examples.map((example) => `  ${example}`),
    "",
  ].join("\n");
}

function formatDoctorCheckStatus(check: DoctorCheckOutput): "INFO" | "MISSING" | "OK" {
  if (check.source === "bundled" || check.source === "project") {
    return "INFO";
  }

  if (check.ok) {
    return check.detail?.startsWith("not detected;") ? "INFO" : "OK";
  }

  return "MISSING";
}

export function formatSetupGuidanceOutput(
  format: OutputFormat,
  output: SetupGuidanceOutput,
): string {
  if (format === "json") {
    return `${JSON.stringify(output, null, 2)}\n`;
  }

  return [`AIQ ${output.requested}`, output.summary, output.replacement, ""].join("\n");
}

export function formatConfigOutput(format: OutputFormat, output: ConfigCommandOutput): string {
  if (format === "json") {
    return `${JSON.stringify(output, null, 2)}\n`;
  }

  const configPath = output.configPath ?? "defaults";
  return [
    "AIQ config",
    `Config: ${configPath}`,
    `Progress: ${output.progressPath} (${output.progressSource})`,
    `Current stage: ${formatProgressStage(output.progress)}`,
    `Profile: ${output.profile}`,
    `Stages: ${output.stages.join(", ")}`,
    "",
  ].join("\n");
}

export function formatConfigInitOutput(format: OutputFormat, output: ConfigInitOutput): string {
  if (format === "json") {
    return `${JSON.stringify(output, null, 2)}\n`;
  }

  return [
    "AIQ config initialized",
    `${output.configCreated ? "Wrote" : "Found"} config: ${output.configPath}`,
    `${output.progressCreated ? "Wrote" : "Found"} progress: ${output.progressPath}`,
    "",
  ].join("\n");
}

export function formatConfigStageOutput(format: OutputFormat, output: ConfigStageOutput): string {
  if (format === "json") {
    return `${JSON.stringify(output, null, 2)}\n`;
  }

  return `Set current_stage=${output.current_stage} in ${output.progressPath}\n`;
}
