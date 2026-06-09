import { stat } from "node:fs/promises";
import path from "node:path";

import * as binaries from "../tools/binary-resolver.js";
import * as commands from "../tools/command-builders.js";
import { findNearestPlaywrightConfig, playwrightConfigNames } from "../tools/native-config.js";
import { hasPackageDependency, readPackageJson } from "../utils/node-utils.js";
import type { JavaScriptRunnerRuntime } from "./contracts.js";
import type { JavaScriptE2eProject } from "./javascript-projects.js";

export type JavaScriptE2eRunner =
  | {
      args: string[];
      command: string;
      kind: "agent-browser" | "playwright-script" | "script";
      name: "agent-browser" | "e2e" | "playwright";
    }
  | {
      installMessage: string;
      kind: "missing-playwright";
      name: "playwright";
    }
  | {
      args: string[];
      command: string;
      kind: "playwright";
      name: "playwright";
    };

export async function findConfiguredJavaScriptE2eProject(
  project: JavaScriptE2eProject,
  runtime: JavaScriptRunnerRuntime,
): Promise<JavaScriptE2eProject | undefined> {
  let projectRoot = project.projectRoot;
  let packageJsonPath = project.packageJsonPath;

  while (true) {
    const candidate = {
      files: project.files,
      packageJsonPath,
      projectRoot,
    };
    if (
      (await resolveJavaScriptE2eRunner(candidate, runtime)) !== undefined &&
      (candidate.packageJsonPath === project.packageJsonPath ||
        (await packageJsonCoversWorkspaceProject(candidate.packageJsonPath, project.projectRoot)))
    ) {
      return candidate;
    }

    let foundAncestorPackage = false;
    let nextRoot = path.dirname(projectRoot);
    while (nextRoot !== projectRoot) {
      const parentPackageJsonPath = path.join(nextRoot, "package.json");
      if (await fileExists(parentPackageJsonPath)) {
        projectRoot = nextRoot;
        packageJsonPath = parentPackageJsonPath;
        foundAncestorPackage = true;
        break;
      }

      projectRoot = nextRoot;
      nextRoot = path.dirname(nextRoot);
    }

    if (!foundAncestorPackage) {
      return undefined;
    }
  }
}

async function packageJsonCoversWorkspaceProject(
  packageJsonPath: string,
  projectRoot: string,
): Promise<boolean> {
  const packageJson = await readPackageJson(packageJsonPath);
  const workspacePatterns = readWorkspacePatterns(packageJson);
  if (workspacePatterns.length === 0) {
    return false;
  }

  const root = path.dirname(packageJsonPath);
  const relativeProjectRoot = path.relative(root, projectRoot).replace(/\\/gu, "/");
  if (relativeProjectRoot.length === 0 || relativeProjectRoot.startsWith("../")) {
    return false;
  }

  return workspacePatterns.some((pattern) =>
    workspacePatternMatchesProject(pattern, relativeProjectRoot),
  );
}

function readWorkspacePatterns(packageJson: Record<string, unknown>): string[] {
  const workspaces = packageJson.workspaces;
  if (Array.isArray(workspaces)) {
    return workspaces.filter((entry): entry is string => typeof entry === "string");
  }

  if (typeof workspaces === "object" && workspaces !== null) {
    const packages = (workspaces as Record<string, unknown>).packages;
    return Array.isArray(packages)
      ? packages.filter((entry): entry is string => typeof entry === "string")
      : [];
  }

  return [];
}

function workspacePatternMatchesProject(pattern: string, relativeProjectRoot: string): boolean {
  const normalizedPattern = pattern.replace(/\\/gu, "/").replace(/\/+$/u, "");
  if (normalizedPattern.endsWith("/**")) {
    const prefix = normalizedPattern.slice(0, -"/**".length);
    return relativeProjectRoot === prefix || relativeProjectRoot.startsWith(`${prefix}/`);
  }

  if (normalizedPattern.endsWith("/*")) {
    const prefix = normalizedPattern.slice(0, -"/*".length);
    if (!relativeProjectRoot.startsWith(`${prefix}/`)) {
      return false;
    }

    return !relativeProjectRoot.slice(prefix.length + 1).includes("/");
  }

  return relativeProjectRoot === normalizedPattern;
}

export async function resolveJavaScriptE2eRunner(
  project: JavaScriptE2eProject,
  runtime: JavaScriptRunnerRuntime,
): Promise<JavaScriptE2eRunner | undefined> {
  const packageJson = await readPackageJson(project.packageJsonPath);
  const script = selectE2eScript(packageJson);
  if (script !== undefined) {
    return {
      args: ["run", script.name, "--", ...script.extraArgs],
      command: binaries.resolveNpmCommand(),
      kind: script.kind,
      name:
        script.kind === "agent-browser"
          ? "agent-browser"
          : script.kind === "script"
            ? "e2e"
            : "playwright",
    };
  }

  if (!(await hasPlaywrightSignals(project, runtime, packageJson))) {
    return undefined;
  }

  const playwrightBinary = await resolveLocalPlaywrightBinary(project.projectRoot);
  if (playwrightBinary === undefined) {
    return {
      installMessage:
        "Playwright e2e is configured, but the local Playwright binary was not found in node_modules/.bin. Run aiq setup for required setup steps, then install this project's dependencies.",
      kind: "missing-playwright",
      name: "playwright",
    };
  }

  const configPath = await findNearestPlaywrightConfig(project.packageJsonPath);
  return {
    args: commands.createPlaywrightTestArgs(configPath === undefined ? {} : { configPath }),
    command: playwrightBinary,
    kind: "playwright",
    name: "playwright",
  };
}

function selectE2eScript(
  packageJson: Record<string, unknown>,
):
  | { extraArgs: string[]; kind: "agent-browser" | "playwright-script" | "script"; name: string }
  | undefined {
  const scripts = readPackageScripts(packageJson);
  const preferredNames = ["aiq:e2e", "test:e2e", "e2e", "audit:ui", "aiq:audit-ui"];
  for (const name of preferredNames) {
    const script = scripts.get(name)?.toLowerCase();
    if (script === undefined) {
      continue;
    }

    if (script.includes("agent-browser") || script.includes("manual-audit")) {
      return { extraArgs: [], kind: "agent-browser", name };
    }

    if (script.includes("playwright")) {
      return { extraArgs: ["--reporter=json"], kind: "playwright-script", name };
    }

    if (name === "aiq:e2e" || name === "test:e2e" || name === "e2e") {
      return { extraArgs: [], kind: "script", name };
    }
  }

  return undefined;
}

async function hasPlaywrightSignals(
  project: JavaScriptE2eProject,
  runtime: JavaScriptRunnerRuntime,
  packageJson: Record<string, unknown>,
): Promise<boolean> {
  return (
    hasPackageDependency(packageJson, "@playwright/test") ||
    hasPackageDependency(packageJson, "playwright") ||
    (await hasAnyProjectFile(project.projectRoot, playwrightConfigNames)) ||
    (await hasAnyPlaywrightSpec(project.projectRoot, runtime))
  );
}

async function hasAnyProjectFile(root: string, names: readonly string[]): Promise<boolean> {
  for (const name of names) {
    if (await fileExists(path.join(root, name))) {
      return true;
    }
  }

  return false;
}

async function hasAnyPlaywrightSpec(
  root: string,
  runtime: JavaScriptRunnerRuntime,
): Promise<boolean> {
  const files = await runtime.findMatchingFiles(
    root,
    (filePath) => isPlaywrightSpecFile(filePath),
    runtime.shouldSkipProjectDirectory,
  );
  return files.length > 0;
}

async function resolveLocalPlaywrightBinary(projectRoot: string): Promise<string | undefined> {
  const binName = process.platform === "win32" ? "playwright.cmd" : "playwright";
  const binaryPath = path.join(projectRoot, "node_modules", ".bin", binName);
  return (await fileExists(binaryPath)) ? binaryPath : undefined;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stats = await stat(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

function isPlaywrightSpecFile(filePath: string): boolean {
  const name = path.basename(filePath).toLowerCase();
  return /\.(?:e2e|spec)\.[cm]?[jt]sx?$/u.test(name);
}

function readPackageScripts(packageJson: Record<string, unknown>): Map<string, string> {
  const scripts = packageJson.scripts;
  if (typeof scripts !== "object" || scripts === null) {
    return new Map();
  }

  return new Map(
    Object.entries(scripts)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
      .map(([name, script]) => [name, script]),
  );
}
