export interface DotNetFormatCommandOptions {
  reportDir: string;
  subcommand: "style" | "whitespace";
  targetPath: string;
  verifyNoChanges?: boolean;
}

export function createDotNetFormatArgs(options: DotNetFormatCommandOptions): string[] {
  return [
    "format",
    options.targetPath,
    options.subcommand,
    ...((options.verifyNoChanges ?? true) ? ["--verify-no-changes"] : []),
    "--report",
    options.reportDir,
    "--verbosity",
    "minimal",
  ];
}

export interface DotNetBuildCommandOptions {
  errorLog?: string;
  nologo?: boolean;
  targetPath: string;
  verbosity?: string;
}

export function createDotNetBuildArgs(options: DotNetBuildCommandOptions): string[] {
  const args = ["build", options.targetPath];
  if (options.nologo ?? true) {
    args.push("--nologo");
  }
  if (options.verbosity !== undefined) {
    args.push("--verbosity", options.verbosity);
  }
  if (options.errorLog !== undefined) {
    args.push(`/p:ErrorLog=${options.errorLog}`);
  }
  return args;
}

export interface DotNetTestCommandOptions {
  logger?: string;
  nologo?: boolean;
  resultsDir?: string;
  targetPath: string;
  verbosity?: string;
}

export function createDotNetTestArgs(options: DotNetTestCommandOptions): string[] {
  const args = ["test", options.targetPath];
  if (options.nologo ?? true) {
    args.push("--nologo");
  }
  if (options.verbosity !== undefined) {
    args.push("--verbosity", options.verbosity);
  }
  if (options.resultsDir !== undefined) {
    args.push("--results-directory", options.resultsDir);
  }
  if (options.logger !== undefined) {
    args.push("--logger", options.logger);
  }
  return args;
}
