import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { LanguageId, StageId } from "@tjalve/aiq/model";

import type {
  DoctorBundledTool,
  DoctorPrerequisite,
  DoctorToolRequirement,
} from "./doctor-types.js";

const execFileAsync = promisify(execFile);

const qualityMetricStages: readonly StageId[] = [
  "lint",
  "format",
  "typecheck",
  "unit",
  "sloc",
  "complexity",
  "maintainability",
  "coverage",
];
const metricStages: readonly StageId[] = ["sloc", "complexity", "maintainability"];
const lizardMetricLanguages: readonly LanguageId[] = [
  "javascript",
  "typescript",
  "go",
  "rust",
  "dotnet",
  "java",
  "kotlin",
];

const externalRequirementDefinitions: readonly {
  languages: readonly LanguageId[];
  requirement: DoctorToolRequirement;
  stages: readonly StageId[];
}[] = [
  {
    languages: ["python"],
    requirement: {
      binaries: ["python3", "python"],
      install: "Install Python 3 and project Python tools such as ruff, ty, pytest, and radon.",
      name: "Python runtime",
      required: true,
      source: "external",
    },
    stages: qualityMetricStages,
  },
  {
    languages: ["go"],
    requirement: {
      binaries: ["go"],
      install: "Install the Go toolchain from your normal toolchain manager.",
      name: "Go toolchain",
      required: true,
      source: "external",
    },
    stages: qualityMetricStages,
  },
  {
    languages: ["rust"],
    requirement: {
      binaries: ["cargo"],
      install: "Install Rust and Cargo with rustup or your normal toolchain manager.",
      name: "Rust Cargo",
      required: true,
      source: "external",
    },
    stages: qualityMetricStages,
  },
  {
    languages: ["dotnet"],
    requirement: {
      binaries: ["dotnet"],
      install: "Install the .NET SDK for this project.",
      name: ".NET SDK",
      required: true,
      source: "external",
    },
    stages: qualityMetricStages,
  },
  {
    languages: ["java", "kotlin"],
    requirement: {
      binaries: ["java"],
      install: "Install a JVM runtime and the project build tool wrapper or Maven/Gradle.",
      name: "JVM runtime",
      required: true,
      source: "external",
    },
    stages: qualityMetricStages,
  },
  {
    languages: ["terraform", "hcl"],
    requirement: {
      binaries: ["terraform"],
      install: "Install Terraform CLI to enable Terraform/HCL lint, format, and validation.",
      name: "Terraform CLI",
      required: true,
      source: "external",
    },
    stages: ["lint", "format", "typecheck"],
  },
];

const bundledToolDefinitions: readonly {
  matches: (languages: ReadonlySet<LanguageId>, selected: ReadonlySet<StageId>) => boolean;
  tool: DoctorBundledTool;
}[] = [
  {
    matches: (languages, selected) =>
      hasJavaScriptOrTypeScript(languages) && usesAnyStage(selected, ["lint", "format"]),
    tool: {
      detail: "provided by the @tjalve/aiq package dependency graph",
      name: "Biome JS/TS lint/format tool",
      source: "bundled",
    },
  },
  {
    matches: (languages, selected) => languages.has("typescript") && selected.has("typecheck"),
    tool: {
      detail: "provided by the @tjalve/aiq package dependency graph",
      name: "TypeScript compiler",
      source: "bundled",
    },
  },
  {
    matches: (languages, selected) =>
      usesAnyStage(selected, ["unit", "coverage"]) && hasJavaScriptOrTypeScript(languages),
    tool: {
      detail: "uses the project's configured npm test runner when present",
      name: "JS/TS test runner",
      source: "project",
    },
  },
  {
    matches: (languages, selected) =>
      usesAnyStage(selected, ["lint", "format"]) &&
      usesAnyLanguage(languages, ["html", "css", "yaml", "sql"]),
    tool: {
      detail: "provided by the @tjalve/aiq package dependency graph",
      name: "Bundled web/data document tools",
      source: "bundled",
    },
  },
  {
    matches: (languages, selected) => selected.has("security") && languages.size > 0,
    tool: {
      detail: "provided by the @tjalve/aiq package runtime",
      name: "AIQ shared security scanner",
      source: "bundled",
    },
  },
];

export function resolveDoctorToolRequirements(
  languages: ReadonlySet<LanguageId>,
  stages: readonly StageId[],
): DoctorToolRequirement[] {
  const requirements = new Map<string, DoctorToolRequirement>();
  const selected = new Set(stages);

  for (const definition of externalRequirementDefinitions) {
    if (
      usesAnyLanguage(languages, definition.languages) &&
      usesAnyStage(selected, definition.stages)
    ) {
      requirements.set(definition.requirement.name, definition.requirement);
    }
  }

  addPowerShellRequirement(requirements, languages, selected);
  addLizardRequirement(requirements, languages, selected);

  return [...requirements.values()];
}

export function resolveDoctorBundledTools(
  languages: ReadonlySet<LanguageId>,
  stages: readonly StageId[],
): DoctorBundledTool[] {
  const selected = new Set(stages);
  const checks = new Map<string, DoctorBundledTool>();

  for (const definition of bundledToolDefinitions) {
    if (definition.matches(languages, selected)) {
      checks.set(definition.tool.name, definition.tool);
    }
  }

  return [...checks.values()];
}

export function mergeDoctorPrerequisites(
  prerequisites: readonly DoctorPrerequisite[],
  requirements: readonly DoctorToolRequirement[],
): Array<DoctorPrerequisite | DoctorToolRequirement> {
  const merged = new Map<string, DoctorPrerequisite | DoctorToolRequirement>();
  for (const prerequisite of prerequisites) {
    merged.set(prerequisite.name, prerequisite);
  }

  for (const requirement of requirements) {
    merged.set(requirement.name, requirement);
  }

  return [...merged.values()];
}

function usesAnyStage(selected: ReadonlySet<StageId>, stages: readonly StageId[]): boolean {
  return stages.some((stage) => selected.has(stage));
}

function usesAnyLanguage(
  languages: ReadonlySet<LanguageId>,
  candidates: readonly LanguageId[],
): boolean {
  return candidates.some((language) => languages.has(language));
}

function hasJavaScriptOrTypeScript(languages: ReadonlySet<LanguageId>): boolean {
  return usesAnyLanguage(languages, ["javascript", "typescript"]);
}

function addPowerShellRequirement(
  requirements: Map<string, DoctorToolRequirement>,
  languages: ReadonlySet<LanguageId>,
  selected: ReadonlySet<StageId>,
): void {
  if (
    !languages.has("powershell") ||
    !usesAnyStage(selected, ["lint", "format", "unit", "coverage"])
  ) {
    return;
  }

  requirements.set("PowerShell runtime", {
    binaries: resolvePowerShellBinaries(),
    install: "Install PowerShell 7 (pwsh) and project PowerShell modules.",
    name: "PowerShell runtime",
    required: true,
    source: "external",
  });
}

function resolvePowerShellBinaries(): string[] {
  return process.platform === "win32"
    ? ["pwsh.exe", "pwsh", "powershell.exe", "powershell"]
    : ["pwsh"];
}

function addLizardRequirement(
  requirements: Map<string, DoctorToolRequirement>,
  languages: ReadonlySet<LanguageId>,
  selected: ReadonlySet<StageId>,
): void {
  if (!usesAnyStage(selected, metricStages) || !usesAnyLanguage(languages, lizardMetricLanguages)) {
    return;
  }

  requirements.set("Lizard metrics tool", {
    binaries: ["lizard"],
    install: "Install lizard where AIQ runs to enable non-Python metrics stages.",
    name: "Lizard metrics tool",
    required: true,
    source: "external",
  });
}

export function validateDoctorPrerequisiteVersion(
  prerequisite: DoctorPrerequisite,
): string | undefined {
  if (prerequisite.minimumMajor === undefined) {
    return undefined;
  }

  if (!prerequisite.binaries.includes("node")) {
    return undefined;
  }

  const major = Number.parseInt(process.versions.node.split(".")[0] ?? "", 10);
  if (Number.isFinite(major) && major >= prerequisite.minimumMajor) {
    return undefined;
  }

  return `detected Node.js ${process.version}; ${prerequisite.install}`;
}

export async function resolveInstalledCommand(
  commandNames: readonly string[],
  options: { includeVersion?: boolean } = {},
): Promise<string | undefined> {
  for (const commandName of commandNames) {
    if (commandName === "node") {
      return options.includeVersion ? `${process.execPath}; ${process.version}` : "detected";
    }

    const result = await runCommand(process.platform === "win32" ? "where" : "which", [
      commandName,
    ]);
    if (result.exitCode === 0) {
      const resolved = result.stdout
        .split(/\r?\n/u)
        .map((value) => value.trim())
        .find((value) => value.length > 0);
      const resolvedCommand = resolved ?? commandName;
      if (!options.includeVersion) {
        return "detected";
      }
      const version = await resolveCommandVersion(resolvedCommand);
      return version === undefined ? resolvedCommand : `${resolvedCommand}; ${version}`;
    }
  }

  return undefined;
}

async function resolveCommandVersion(command: string): Promise<string | undefined> {
  const result = await runCommand(command, ["--version"]);
  if (result.exitCode !== 0) {
    return undefined;
  }

  return result.stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
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
