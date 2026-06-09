export interface TyCheckCommandOptions {
  files: string[];
  pythonPath: string;
}

export function createTyCheckArgs(options: TyCheckCommandOptions): string[] {
  return [
    "check",
    "--python",
    options.pythonPath,
    "--output-format",
    "gitlab",
    "--no-progress",
    "--color",
    "never",
    ...options.files,
  ];
}

export interface TyCommandOptions {
  files: string[];
}

export function createTyArgs(options: TyCommandOptions): string[] {
  return ["check", "--output-format", "gitlab", ...options.files];
}
