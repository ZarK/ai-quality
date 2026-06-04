import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  resolveDotNetCommand,
  resolveGradleCommand,
  resolveMavenCommand,
  resolvePythonCommand,
  resolveTyCommand,
} from "../src/tools/binary-resolver.js";

export function commandAvailable(command: string): boolean {
  try {
    execFileSync(process.platform === "win32" ? "where" : "which", [command], {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

export function commandSucceeds(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): boolean {
  try {
    execFileSync(command, args, {
      cwd: options.cwd,
      env: options.env === undefined ? process.env : { ...process.env, ...options.env },
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

export function hasDotNetSdkMajor(major: number): boolean {
  try {
    const output = execFileSync(resolveDotNetCommand(), ["--list-sdks"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return output
      .split(/\r?\n/u)
      .some((line) => Number.parseInt(line.split(".")[0] ?? "", 10) >= major);
  } catch {
    return false;
  }
}

export const hasPythonPytestToolchain = commandSucceeds(
  resolvePythonCommand(),
  ["-c", "import pytest"],
  { env: { PYTEST_DISABLE_PLUGIN_AUTOLOAD: "1" } },
);

export const hasPythonQualityToolchain =
  commandSucceeds(resolvePythonCommand(), [
    "-c",
    "import pytest, pytest_cov, radon; import ruff",
  ]) && commandAvailable(resolveTyCommand());

export const hasDotNet10Toolchain = hasDotNetSdkMajor(10);

export const hasGoToolchain =
  commandAvailable("go") &&
  commandAvailable("gofmt") &&
  commandSucceeds("go", ["version"]) &&
  commandSucceeds("go", ["test", "./..."], { cwd: path.resolve("test-projects/go") }) &&
  commandAvailable("lizard");

export const hasRustToolchain =
  commandAvailable("cargo") &&
  commandSucceeds("cargo", ["--version"]) &&
  commandAvailable("lizard");

export const hasRustCoverageToolchain =
  hasRustToolchain && commandSucceeds("cargo", ["llvm-cov", "--version"]);

export const hasMavenToolchain =
  commandAvailable(resolveMavenCommand()) && commandSucceeds(resolveMavenCommand(), ["--version"]);

export const hasGradleToolchain =
  commandAvailable(resolveGradleCommand()) &&
  commandSucceeds(resolveGradleCommand(), ["--version"]);

export function resolvePowerShellCommand(): string | undefined {
  const candidates =
    process.platform === "win32" ? ["pwsh.exe", "pwsh", "powershell.exe", "powershell"] : ["pwsh"];
  return candidates.find((command) => commandAvailable(command));
}

export function hasPowerShellModule(moduleName: string): boolean {
  const powerShell = resolvePowerShellCommand();
  if (powerShell === undefined) {
    return false;
  }

  return commandSucceeds(powerShell, [
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    `if (Get-Module -ListAvailable -Name '${moduleName.replace(/'/gu, "''")}') { exit 0 } else { exit 1 }`,
  ]);
}

export const hasPowerShellAnalyzerToolchain = hasPowerShellModule("PSScriptAnalyzer");

export const hasPowerShellPesterToolchain =
  hasPowerShellModule("Pester") &&
  (() => {
    const powerShell = resolvePowerShellCommand();
    if (powerShell === undefined) {
      return false;
    }

    if (
      !commandSucceeds(powerShell, [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Import-Module Pester; if ((Get-Module Pester).Version.Major -ge 5) { exit 0 } else { exit 1 }",
      ])
    ) {
      return false;
    }

    const tempDir = mkdtempSync(path.join(os.tmpdir(), "aiq-pester-probe-"));
    const testPath = path.join(tempDir, "Probe.Tests.ps1");

    try {
      writeFileSync(
        testPath,
        [
          "BeforeAll { $script:value = 1 }",
          'Describe "AIQ Pester probe" {',
          '  It "runs a passing test" {',
          "    $script:value | Should -Be 1",
          "  }",
          "}",
          "",
        ].join("\n"),
        "utf8",
      );

      return commandSucceeds(powerShell, [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `Import-Module Pester; Invoke-Pester -Path '${testPath.replace(/'/gu, "''")}' -PassThru | Out-Null`,
      ]);
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  })();
