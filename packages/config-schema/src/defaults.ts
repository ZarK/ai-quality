import { cloneProfileConfig } from "./clone.js";
import { aiqLanguageIds, aiqProgressStageIndexes, aiqStageIds } from "./types.js";
import type {
  AiqConfig,
  AiqLanguageId,
  AiqProfileConfig,
  AiqProfileName,
  AiqProgressState,
  AiqStageConfig,
  AiqStageId,
  AiqStageLanguageConfig,
  AiqToolId,
} from "./types.js";

const defaultStageLanguageTools: Record<AiqStageId, Partial<Record<AiqLanguageId, AiqToolId>>> = {
  lint: {
    javascript: "biome",
    typescript: "biome",
    python: "python",
    terraform: "terraform",
    hcl: "terraform",
    go: "go",
    rust: "rust",
    dotnet: "dotnet",
    java: "jvm",
    kotlin: "jvm",
    bash: "bash",
    powershell: "powershell",
    html: "html",
    css: "css",
    yaml: "yaml",
    sql: "sql",
  },
  format: {
    javascript: "biome",
    typescript: "biome",
    terraform: "terraform",
    hcl: "terraform",
    go: "go",
    rust: "rust",
    dotnet: "dotnet",
    java: "jvm",
    kotlin: "jvm",
    python: "python",
    bash: "bash",
    powershell: "powershell",
    html: "documents",
    css: "documents",
    yaml: "documents",
    sql: "sql",
  },
  typecheck: {
    terraform: "terraform",
    go: "go",
    rust: "rust",
    dotnet: "dotnet",
    java: "jvm",
    kotlin: "jvm",
    typescript: "typescript",
    python: "python",
  },
  unit: {
    bash: "bash",
    powershell: "powershell",
    go: "go",
    rust: "rust",
    dotnet: "dotnet",
    java: "jvm",
    kotlin: "jvm",
    javascript: "javascript",
    typescript: "javascript",
    python: "python",
  },
  e2e: {
    javascript: "javascript",
    typescript: "javascript",
  },
  sloc: {
    javascript: "javascript",
    typescript: "javascript",
    go: "go",
    rust: "rust",
    dotnet: "dotnet",
    java: "jvm",
    kotlin: "jvm",
    python: "python",
  },
  complexity: {
    javascript: "javascript",
    typescript: "javascript",
    go: "go",
    rust: "rust",
    dotnet: "dotnet",
    java: "jvm",
    kotlin: "jvm",
    python: "python",
  },
  maintainability: {
    javascript: "javascript",
    typescript: "javascript",
    go: "go",
    rust: "rust",
    dotnet: "dotnet",
    java: "jvm",
    kotlin: "jvm",
    python: "python",
  },
  coverage: {
    bash: "bash",
    powershell: "powershell",
    go: "go",
    rust: "rust",
    dotnet: "dotnet",
    java: "jvm",
    kotlin: "jvm",
    javascript: "javascript",
    typescript: "javascript",
    python: "python",
  },
  security: Object.fromEntries(
    aiqLanguageIds.map((languageId) => [languageId, "security"]),
  ) as Partial<Record<AiqLanguageId, AiqToolId>>,
};

export const supportedStageToolIds: Record<AiqStageId, readonly AiqToolId[]> = aiqStageIds.reduce(
  (accumulator, stageId) => {
    accumulator[stageId] = [...new Set(Object.values(defaultStageLanguageTools[stageId]))].sort();
    return accumulator;
  },
  {} as Record<AiqStageId, readonly AiqToolId[]>,
);

export const defaultConfig: AiqConfig = {
  version: 1,
  inputs: {
    ignore: ["node_modules/**", ".git/**", ".venv/**", "dist/**", "build/**"],
  },
  stages: Object.fromEntries(
    aiqStageIds.map((stageId) => [stageId, createDefaultStageConfig(stageId)]),
  ) as Record<AiqStageId, AiqStageConfig>,
  profiles: {
    fast: {
      changedOnly: true,
      stages: ["lint"],
    },
    standard: {
      changedOnly: false,
      stages: ["lint", "typecheck", "unit"],
    },
    deep: {
      changedOnly: false,
      stages: ["lint", "typecheck", "unit", "coverage", "security"],
    },
  },
  surfaces: {
    cli: {
      profile: "fast",
    },
    hook: {
      profile: "fast",
    },
    github: {
      profile: "deep",
      publishDiagnostics: true,
    },
    opencode: {
      profile: "fast",
      publishDiagnostics: true,
    },
    lsp: {
      profile: "fast",
      publishDiagnostics: true,
    },
    mcp: {
      profile: "fast",
    },
    watch: {
      profile: "fast",
    },
    serve: {
      profile: "standard",
    },
  },
};

export const defaultProgressState: AiqProgressState = {
  current_stage: 1,
  disabled: [],
  order: [...aiqProgressStageIndexes],
  last_run: null,
};

export function resolveProfile(config: AiqConfig, profile?: AiqProfileName): AiqProfileConfig {
  const selected = profile ?? "fast";
  return cloneProfileConfig(config.profiles[selected]);
}

function createDefaultStageConfig(stageId: AiqStageId): AiqStageConfig {
  return {
    enabled: true,
    languages: Object.fromEntries(
      Object.entries(defaultStageLanguageTools[stageId]).map(([languageId, tool]) => [
        languageId,
        { enabled: true, tool },
      ]),
    ) as Partial<Record<AiqLanguageId, AiqStageLanguageConfig>>,
  };
}
