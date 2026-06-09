export interface ShellcheckCommandOptions {
  files: string[];
}

export function createShellcheckArgs(options: ShellcheckCommandOptions): string[] {
  return ["-f", "json1", ...options.files];
}

export interface ShfmtCommandOptions {
  files: string[];
}

export function createShfmtArgs(options: ShfmtCommandOptions): string[] {
  return ["-l", ...options.files];
}
