import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { cp, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { Diagnostic, StageResult, ToolRunResult } from "../contracts.js";
import * as parsers from "../parsers/index.js";
import * as commands from "../tools/command-builders.js";
import type { HashicorpRunnerRuntime } from "./contracts.js";
import type { HashicorpProjectToolResult } from "./hashicorp-generic-hcl-tools.js";
import {
  createTerraformValidationCacheKey,
  createTerraformValidationManifestKey,
  deduplicateDiagnostics,
  joinOutputs,
  normalizeDiagnosticsToSelection,
  readProjectLabel,
  resolveTerraformValidationFiles,
} from "./hashicorp-tool-helpers.js";
import type { HashicorpProject } from "./hashicorp.js";
export { runGenericHclFormatFile, runGenericHclLintFile } from "./hashicorp-generic-hcl-tools.js";

export type TerraformValidationProjectResult = {
  diagnostics: Diagnostic[];
  durationMs: number;
  note: string;
  status: StageResult["status"];
  toolRuns: ToolRunResult[];
};

export async function getTerraformValidationProjectResult(
  project: HashicorpProject,
  runtime: HashicorpRunnerRuntime,
): Promise<{ cacheHit: boolean; result: TerraformValidationProjectResult }> {
  const validationFiles = await resolveTerraformValidationFiles(project.projectRoot);
  const manifestKey = createTerraformValidationManifestKey(project.projectRoot, validationFiles);
  const cacheKey = await createTerraformValidationCacheKey(validationFiles, manifestKey);
  const cached = await runtime.getCachedValue("terraform:validate", manifestKey, cacheKey, () =>
    runTerraformProjectValidateTask(project, runtime),
  );

  return {
    cacheHit: cached.cacheHit,
    result: cached.value,
  };
}

export async function runTerraformFormatProject(
  project: HashicorpProject,
  terraformBinary: string,
  runtime: HashicorpRunnerRuntime,
): Promise<HashicorpProjectToolResult> {
  const args = commands.createTerraformFmtArgs({
    files: project.terraformFiles.map((file) => path.relative(project.projectRoot, file)),
  });
  const outcome = await runtime.runExecutable(
    terraformBinary,
    args,
    project.projectRoot,
    runtime.signal,
  );
  const parsedDiagnostics = normalizeDiagnosticsToSelection(
    parsers.parseTerraformFormatDiagnostics(outcome.stdout, project.projectRoot),
    project.terraformFiles,
  );

  addTerraformFormatFailureDiagnostics(project, runtime, outcome, parsedDiagnostics);

  const status = outcome.exitCode === 0 && parsedDiagnostics.length === 0 ? "passed" : "failed";
  return createTerraformFormatResult(project, runtime, args, outcome, parsedDiagnostics, status);
}

async function runTerraformProjectValidateTask(
  project: HashicorpProject,
  runtime: HashicorpRunnerRuntime,
): Promise<TerraformValidationProjectResult> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "aiq-terraform-validate-"));

  try {
    const tempProjectRoot = path.join(tempDir, "project");
    await cp(project.projectRoot, tempProjectRoot, { recursive: true });

    const setup = await runTerraformValidateInit(runtime, tempDir, tempProjectRoot);

    if (setup.initOutcome.exitCode !== 0) {
      return createTerraformInitFailureResult(project, runtime, setup.initOutcome, setup.toolRuns);
    }

    return await runTerraformValidate(project, runtime, tempProjectRoot, setup);
  } finally {
    await rm(tempDir, { force: true, recursive: true }).catch(() => undefined);
  }
}

function addTerraformFormatFailureDiagnostics(
  project: HashicorpProject,
  runtime: HashicorpRunnerRuntime,
  outcome: Awaited<ReturnType<HashicorpRunnerRuntime["runExecutable"]>>,
  diagnostics: Diagnostic[],
): void {
  if (outcome.exitCode === 0 || diagnostics.length > 0) {
    return;
  }

  diagnostics.push(
    ...parsers.parseTerraformSyntaxDiagnostics(
      joinOutputs(outcome.stderr, outcome.stdout),
      project.terraformFiles[0] ?? project.projectRoot,
      "terraform-fmt",
    ),
  );

  if (diagnostics.length > 0) {
    return;
  }

  diagnostics.push(
    runtime.createProcessFailureDiagnostic(
      project.terraformFiles[0] ?? project.projectRoot,
      "terraform-fmt",
      runtime.readProcessFailureMessage(
        "terraform fmt",
        outcome.stderr,
        outcome.stdout,
        outcome.exitCode,
      ),
    ),
  );
}

function createTerraformFormatResult(
  project: HashicorpProject,
  runtime: HashicorpRunnerRuntime,
  args: string[],
  outcome: Awaited<ReturnType<HashicorpRunnerRuntime["runExecutable"]>>,
  diagnostics: Diagnostic[],
  status: StageResult["status"],
): HashicorpProjectToolResult {
  return {
    diagnostics,
    durationMs: outcome.durationMs,
    note:
      status === "passed"
        ? `terraform fmt passed for ${readProjectLabel(project.projectRoot)}.`
        : `terraform fmt reported ${diagnostics.length} formatting diagnostic${diagnostics.length === 1 ? "" : "s"} for ${readProjectLabel(project.projectRoot)}.`,
    status,
    toolRun: runtime.createToolRunResult(
      "terraform-fmt",
      args,
      outcome.durationMs,
      outcome.exitCode,
      status,
      outcome.finishedAt,
      outcome.startedAt,
    ),
  };
}

async function runTerraformValidateInit(
  runtime: HashicorpRunnerRuntime,
  tempDir: string,
  tempProjectRoot: string,
): Promise<{
  env: Record<string, string>;
  initOutcome: Awaited<ReturnType<HashicorpRunnerRuntime["runExecutable"]>>;
  terraformBinary: string;
  toolRuns: ToolRunResult[];
}> {
  const terraformBinary = await runtime.resolveRequiredBinary(
    ["terraform"],
    "Terraform",
    "Install 'terraform' to enable Terraform validation.",
  );
  const env = createTerraformValidateEnv(tempDir);
  const initArgs = commands.createTerraformInitArgs({ disableBackend: true, disableInput: true });
  const initOutcome = await runtime.runExecutable(
    terraformBinary,
    initArgs,
    tempProjectRoot,
    runtime.signal,
    env,
  );
  const initStatus = initOutcome.exitCode === 0 ? "passed" : "failed";
  return {
    env,
    initOutcome,
    terraformBinary,
    toolRuns: [
      runtime.createToolRunResult(
        "terraform-init",
        initArgs,
        initOutcome.durationMs,
        initOutcome.exitCode,
        initStatus,
        initOutcome.finishedAt,
        initOutcome.startedAt,
      ),
    ],
  };
}

async function runTerraformValidate(
  project: HashicorpProject,
  runtime: HashicorpRunnerRuntime,
  tempProjectRoot: string,
  setup: {
    env: Record<string, string>;
    initOutcome: Awaited<ReturnType<HashicorpRunnerRuntime["runExecutable"]>>;
    terraformBinary: string;
    toolRuns: ToolRunResult[];
  },
): Promise<TerraformValidationProjectResult> {
  const validateArgs = commands.createTerraformValidateArgs();
  const validateOutcome = await runtime.runExecutable(
    setup.terraformBinary,
    validateArgs,
    tempProjectRoot,
    runtime.signal,
    setup.env,
  );
  const diagnostics = readTerraformValidateDiagnostics(project, runtime, validateOutcome);
  const status = validateOutcome.exitCode === 0 && diagnostics.length === 0 ? "passed" : "failed";
  setup.toolRuns.push(
    runtime.createToolRunResult(
      "terraform-validate",
      validateArgs,
      validateOutcome.durationMs,
      validateOutcome.exitCode,
      status,
      validateOutcome.finishedAt,
      validateOutcome.startedAt,
    ),
  );

  return {
    diagnostics: deduplicateDiagnostics(diagnostics),
    durationMs: setup.initOutcome.durationMs + validateOutcome.durationMs,
    note: readTerraformValidateNote(project.projectRoot, status, diagnostics.length),
    status,
    toolRuns: setup.toolRuns,
  };
}

function readTerraformValidateDiagnostics(
  project: HashicorpProject,
  runtime: HashicorpRunnerRuntime,
  validateOutcome: Awaited<ReturnType<HashicorpRunnerRuntime["runExecutable"]>>,
): Diagnostic[] {
  const diagnostics = normalizeDiagnosticsToSelection(
    parsers.parseTerraformValidateDiagnostics(
      validateOutcome.stdout,
      project.projectRoot,
      project.terraformFiles[0] ?? project.projectRoot,
    ),
    project.terraformFiles,
  );

  if (validateOutcome.exitCode !== 0 && diagnostics.length === 0) {
    diagnostics.push(
      runtime.createProcessFailureDiagnostic(
        project.terraformFiles[0] ?? project.projectRoot,
        "terraform-validate",
        runtime.readProcessFailureMessage(
          "terraform validate",
          validateOutcome.stderr,
          validateOutcome.stdout,
          validateOutcome.exitCode,
        ),
      ),
    );
  }

  return diagnostics;
}

function createTerraformValidateEnv(tempDir: string): Record<string, string> {
  return {
    CHECKPOINT_DISABLE: "1",
    TF_DATA_DIR: path.join(tempDir, ".terraform-data"),
    TF_IN_AUTOMATION: "1",
  };
}

function createTerraformInitFailureResult(
  project: HashicorpProject,
  runtime: HashicorpRunnerRuntime,
  initOutcome: Awaited<ReturnType<HashicorpRunnerRuntime["runExecutable"]>>,
  toolRuns: ToolRunResult[],
): TerraformValidationProjectResult {
  return {
    diagnostics: [
      runtime.createProcessFailureDiagnostic(
        project.terraformFiles[0] ?? project.projectRoot,
        "terraform-init",
        runtime.readProcessFailureMessage(
          "terraform init",
          initOutcome.stderr,
          initOutcome.stdout,
          initOutcome.exitCode,
        ),
      ),
    ],
    durationMs: initOutcome.durationMs,
    note: `terraform init failed for ${readProjectLabel(project.projectRoot)}.`,
    status: "failed",
    toolRuns,
  };
}

function readTerraformValidateNote(
  projectRoot: string,
  status: StageResult["status"],
  diagnosticCount: number,
): string {
  if (status === "passed") {
    return `terraform validate passed for ${readProjectLabel(projectRoot)}.`;
  }

  return `terraform validate reported ${diagnosticCount} diagnostic${diagnosticCount === 1 ? "" : "s"} for ${readProjectLabel(projectRoot)}.`;
}
