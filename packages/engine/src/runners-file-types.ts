import path from "node:path";

import { isJvmTaskFile as isJvmLanguageTaskFile } from "./languages/jvm.js";
import {
  pythonTaskExtensions as pythonExtensions,
  pythonTaskConfigNames,
} from "./languages/python.js";

export const biomeExtensions = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".jsx",
  ".json",
  ".jsonc",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
]);
export const sharedBiomeExtensions = new Set([".json", ".jsonc"]);
export const javaScriptExtensions = new Set([".cjs", ".js", ".jsx", ".mjs"]);
export const typeScriptExtensions = new Set([".cts", ".mts", ".ts", ".tsx"]);
export const javaScriptMetricsSourceExtensions = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
]);
export const bashExtensions = new Set([".bash", ".sh"]);
export const bashTestExtensions = new Set([".bats"]);
export const powerShellExtensions = new Set([".ps1", ".psd1", ".psm1"]);
export const dotNetSourceExtensions = new Set([".cs"]);
export const dotNetProjectExtensions = new Set([".csproj", ".sln", ".slnx"]);
export const htmlExtensions = new Set([".htm", ".html"]);
export const cssExtensions = new Set([".css"]);
export const yamlExtensions = new Set([".yaml", ".yml"]);
export const sqlExtensions = new Set([".sql"]);
export const prettierDocumentExtensions = new Set([
  ...htmlExtensions,
  ...cssExtensions,
  ...yamlExtensions,
]);

export const dotNetExtensions = new Set([...dotNetSourceExtensions, ...dotNetProjectExtensions]);
export const goSourceExtensions = new Set([".go"]);
export const rustSourceExtensions = new Set([".rs"]);
export const javaSourceExtensions = new Set([".java"]);
export const kotlinSourceExtensions = new Set([".kt"]);
export const javaScriptProjectConfigNames = ["package.json"];
export const goProjectConfigNames = ["go.mod", "go.sum"];
export const rustProjectConfigNames = ["Cargo.toml", "Cargo.lock"];
export const jvmBuildConfigNames = ["build.gradle.kts", "build.gradle", "pom.xml"];
export const jvmSettingsConfigNames = ["settings.gradle.kts", "settings.gradle"];
export const jvmTaskConfigNames = [...jvmBuildConfigNames, ...jvmSettingsConfigNames];
export const securityExtensions = new Set([
  ".bats",
  ".bash",
  ".cjs",
  ".css",
  ".cs",
  ".csproj",
  ".cts",
  ".go",
  ".hcl",
  ".html",
  ".mod",
  ".js",
  ".json",
  ".jsonc",
  ".java",
  ".jsx",
  ".kt",
  ".kts",
  ".mjs",
  ".mts",
  ".ps1",
  ".psd1",
  ".psm1",
  ".py",
  ".pyi",
  ".rs",
  ".sh",
  ".sql",
  ".sum",
  ".tf",
  ".tfvars",
  ".toml",
  ".gradle",
  ".lock",
  ".sln",
  ".slnx",
  ".ts",
  ".tsx",
  ".xml",
  ".yaml",
  ".yml",
]);

export function shouldSkipScriptProjectDirectory(directoryPath: string): boolean {
  const name = path.basename(directoryPath).toLowerCase();
  return [
    ".git",
    ".hg",
    ".svn",
    ".venv",
    "__pycache__",
    "bin",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "obj",
    "target",
    "vendor",
  ].includes(name);
}

export function isPythonTaskFile(file: string): boolean {
  const extension = path.extname(file).toLowerCase();
  if (pythonExtensions.has(extension)) {
    return true;
  }

  return pythonTaskConfigNames.includes(path.basename(file).toLowerCase());
}

export function isJavaScriptMetricsTaskFile(file: string): boolean {
  const extension = path.extname(file).toLowerCase();
  if (javaScriptMetricsSourceExtensions.has(extension)) {
    return true;
  }

  return path.basename(file).toLowerCase() === "package.json";
}

export function isGoTaskFile(file: string): boolean {
  const extension = path.extname(file).toLowerCase();
  if (goSourceExtensions.has(extension)) {
    return true;
  }

  return goProjectConfigNames.includes(path.basename(file).toLowerCase());
}

export function isRustTaskFile(file: string): boolean {
  const extension = path.extname(file).toLowerCase();
  if (rustSourceExtensions.has(extension)) {
    return true;
  }

  return rustProjectConfigNames.includes(path.basename(file));
}
