export interface RuffCheckCommandOptions {
  files: string[];
}

export function createRuffCheckArgs(options: RuffCheckCommandOptions): string[] {
  return ["-m", "ruff", "check", "--output-format", "json", ...options.files];
}

export interface RuffFormatCommandOptions {
  files: string[];
}

export function createRuffFormatArgs(options: RuffFormatCommandOptions): string[] {
  return ["-m", "ruff", "format", ...options.files, "--check"];
}
