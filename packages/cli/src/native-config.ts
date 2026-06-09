import type { Dirent } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import type { LanguageId, StageId } from "@tjalve/aiq/model";

import type { DoctorCheckOutput } from "./output.js";
import { defaultProjectScopeIgnoredDirectoryNames } from "./project-scope.js";

interface NativeConfigDetection {
  biome: boolean;
  jsTest: boolean;
  lizard: boolean;
  playwright: boolean;
  pythonQuality: boolean;
  tsconfig: boolean;
}

const maxScannedFiles = 2_000;

const jsTestConfigNames = new Set([
  "jest.config.cjs",
  "jest.config.js",
  "jest.config.mjs",
  "jest.config.ts",
  "vitest.config.cjs",
  "vitest.config.cts",
  "vitest.config.js",
  "vitest.config.mjs",
  "vitest.config.mts",
  "vitest.config.ts",
]);

const lizardConfigNames = new Set([".lizard", ".lizardrc", "lizard.conf"]);

const playwrightConfigNames = new Set([
  "playwright.config.cjs",
  "playwright.config.cts",
  "playwright.config.js",
  "playwright.config.mjs",
  "playwright.config.mts",
  "playwright.config.ts",
]);

const pythonQualityConfigNames = new Set([
  ".ruff.toml",
  "pyproject.toml",
  "radon.cfg",
  "ruff.toml",
  "setup.cfg",
  "tox.ini",
]);

const e2ePackageScriptNames = ["aiq:e2e", "test:e2e", "e2e", "audit:ui", "aiq:audit-ui"];

export async function detectNativeConfigs(cwd: string): Promise<NativeConfigDetection> {
  const configs: NativeConfigDetection = {
    biome: false,
    jsTest: false,
    lizard: false,
    playwright: false,
    pythonQuality: false,
    tsconfig: false,
  };
  await collectNativeConfigs(cwd, configs, { scannedFiles: 0 });
  return configs;
}

export function resolveDoctorNativeConfigChecks(
  languages: ReadonlySet<LanguageId>,
  stages: readonly StageId[],
  configs: NativeConfigDetection,
): DoctorCheckOutput[] {
  const selected = new Set(stages);
  const checks: DoctorCheckOutput[] = [];
  const hasJavaScriptOrTypeScript = languages.has("javascript") || languages.has("typescript");

  addJavaScriptNativeConfigChecks(checks, languages, selected, configs, hasJavaScriptOrTypeScript);
  addPythonNativeConfigChecks(checks, languages, selected, configs);

  return checks;
}

async function collectNativeConfigs(
  directory: string,
  configs: NativeConfigDetection,
  state: { scannedFiles: number },
): Promise<void> {
  if (state.scannedFiles >= maxScannedFiles) {
    return;
  }

  let entries: Dirent[];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (state.scannedFiles >= maxScannedFiles) {
      return;
    }

    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!defaultProjectScopeIgnoredDirectoryNames.has(entry.name)) {
        await collectNativeConfigs(entryPath, configs, state);
      }
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    state.scannedFiles += 1;
    await addNativeConfig(entryPath, configs);
  }
}

async function addNativeConfig(filePath: string, configs: NativeConfigDetection): Promise<void> {
  const fileName = path.basename(filePath);
  addFileNameNativeConfig(fileName, configs);

  if (fileName === "package.json") {
    await addPackageNativeConfig(filePath, configs);
  }
}

async function addPackageNativeConfig(
  packageJsonPath: string,
  configs: NativeConfigDetection,
): Promise<void> {
  let packageJson: unknown;
  try {
    packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as unknown;
  } catch {
    return;
  }

  if (!isRecord(packageJson)) {
    return;
  }

  if (hasJavaScriptTestConfig(packageJson)) {
    configs.jsTest = true;
  }

  if (hasJavaScriptE2eConfig(packageJson)) {
    configs.playwright = true;
  }
}

function addJavaScriptNativeConfigChecks(
  checks: DoctorCheckOutput[],
  languages: ReadonlySet<LanguageId>,
  selected: ReadonlySet<StageId>,
  configs: NativeConfigDetection,
  hasJavaScriptOrTypeScript: boolean,
): void {
  if (!hasJavaScriptOrTypeScript) {
    return;
  }

  addBiomeCheck(checks, selected, configs);
  addTypeScriptCheck(checks, languages, selected, configs);
  addJavaScriptTestCheck(checks, selected, configs);
  addJavaScriptE2eCheck(checks, selected, configs);
  addLizardCheck(checks, selected, configs);
}

function addBiomeCheck(
  checks: DoctorCheckOutput[],
  selected: ReadonlySet<StageId>,
  configs: NativeConfigDetection,
): void {
  if (!usesAnyStage(selected, ["lint", "format"])) {
    return;
  }

  checks.push({
    detail: configs.biome
      ? "detected; Biome will use repository config"
      : "not detected; Biome will use built-in defaults unless repository config is added",
    name: "Biome native config",
    ok: true,
    required: false,
    source: "project",
  });
}

function addTypeScriptCheck(
  checks: DoctorCheckOutput[],
  languages: ReadonlySet<LanguageId>,
  selected: ReadonlySet<StageId>,
  configs: NativeConfigDetection,
): void {
  if (!languages.has("typescript") || !selected.has("typecheck")) {
    return;
  }

  checks.push({
    detail: configs.tsconfig
      ? "detected; TypeScript typecheck uses tsconfig.json"
      : "not detected; add tsconfig.json before running TypeScript typecheck",
    name: "TypeScript project config",
    ok: configs.tsconfig,
    required: true,
    source: "project",
  });
}

function addJavaScriptTestCheck(
  checks: DoctorCheckOutput[],
  selected: ReadonlySet<StageId>,
  configs: NativeConfigDetection,
): void {
  if (!usesAnyStage(selected, ["unit", "coverage"])) {
    return;
  }

  checks.push({
    detail: configs.jsTest
      ? "detected; JS/TS tests use the repository test runner config or package script"
      : "not detected; add Vitest/Jest config or a package test script before running unit or coverage",
    name: "JS/TS test config",
    ok: configs.jsTest,
    required: true,
    source: "project",
  });
}

function addJavaScriptE2eCheck(
  checks: DoctorCheckOutput[],
  selected: ReadonlySet<StageId>,
  configs: NativeConfigDetection,
): void {
  if (!selected.has("e2e")) {
    return;
  }

  checks.push({
    detail: configs.playwright
      ? "detected; e2e uses Playwright config or a project e2e/audit script"
      : "not detected; add Playwright config/tests or a project e2e/audit script before running e2e",
    name: "JS/TS e2e config",
    ok: configs.playwright,
    required: true,
    source: "project",
  });
}

function addLizardCheck(
  checks: DoctorCheckOutput[],
  selected: ReadonlySet<StageId>,
  configs: NativeConfigDetection,
): void {
  if (!usesAnyStage(selected, ["sloc", "complexity", "maintainability"])) {
    return;
  }

  checks.push({
    detail: configs.lizard
      ? "detected; metrics cache tracks lizard config changes"
      : "not detected; lizard metrics use AIQ defaults unless repository config is added",
    name: "Lizard metrics config",
    ok: true,
    required: false,
    source: "project",
  });
}

function addPythonNativeConfigChecks(
  checks: DoctorCheckOutput[],
  languages: ReadonlySet<LanguageId>,
  selected: ReadonlySet<StageId>,
  configs: NativeConfigDetection,
): void {
  if (
    !languages.has("python") ||
    !usesAnyStage(selected, ["lint", "format", "complexity", "maintainability"])
  ) {
    return;
  }

  checks.push({
    detail: configs.pythonQuality
      ? "detected; Python tools use repository quality config"
      : "not detected; Ruff and Radon-compatible tools will use their defaults unless repository config is added",
    name: "Python quality config",
    ok: true,
    required: false,
    source: "project",
  });
}

function addFileNameNativeConfig(fileName: string, configs: NativeConfigDetection): void {
  if (fileName === "biome.json" || fileName === "biome.jsonc") {
    configs.biome = true;
  }
  if (jsTestConfigNames.has(fileName)) {
    configs.jsTest = true;
  }
  if (lizardConfigNames.has(fileName)) {
    configs.lizard = true;
  }
  if (playwrightConfigNames.has(fileName)) {
    configs.playwright = true;
  }
  if (pythonQualityConfigNames.has(fileName)) {
    configs.pythonQuality = true;
  }
  if (fileName === "tsconfig.json") {
    configs.tsconfig = true;
  }
}

function hasJavaScriptTestConfig(packageJson: Record<string, unknown>): boolean {
  const testScript = readNestedString(packageJson, ["scripts", "test"])?.toLowerCase() ?? "";
  return (
    testScript.includes("vitest") ||
    testScript.includes("jest") ||
    hasPackageDependency(packageJson, "vitest") ||
    hasPackageDependency(packageJson, "jest")
  );
}

function hasJavaScriptE2eConfig(packageJson: Record<string, unknown>): boolean {
  const e2eScripts = e2ePackageScriptNames
    .map((scriptName) => readNestedString(packageJson, ["scripts", scriptName])?.toLowerCase())
    .filter((script): script is string => script !== undefined);
  return (
    e2eScripts.length > 0 ||
    hasPackageDependency(packageJson, "@playwright/test") ||
    hasPackageDependency(packageJson, "playwright") ||
    e2eScripts.some(hasE2eScriptCommand)
  );
}

function hasE2eScriptCommand(script: string): boolean {
  return (
    script.includes("playwright") ||
    script.includes("agent-browser") ||
    script.includes("manual-audit")
  );
}

function hasPackageDependency(packageJson: Record<string, unknown>, dependency: string): boolean {
  return (
    readNestedString(packageJson, ["dependencies", dependency]) !== undefined ||
    readNestedString(packageJson, ["devDependencies", dependency]) !== undefined
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNestedString(record: Record<string, unknown>, keys: string[]): string | undefined {
  let current: unknown = record;

  for (const key of keys) {
    if (typeof current !== "object" || current === null || !(key in current)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === "string" ? current : undefined;
}

function usesAnyStage(selected: ReadonlySet<StageId>, stages: readonly StageId[]): boolean {
  return stages.some((stage) => selected.has(stage));
}
