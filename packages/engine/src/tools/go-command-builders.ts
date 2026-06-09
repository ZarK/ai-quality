export interface GoVetCommandOptions {
  packages?: string[];
}

export function createGoVetArgs(options: GoVetCommandOptions = {}): string[] {
  return ["vet", "-json", ...(options.packages ?? ["./..."])];
}

export interface GoBuildCommandOptions {
  packages?: string[];
}

export function createGoBuildArgs(options: GoBuildCommandOptions = {}): string[] {
  return ["build", ...(options.packages ?? ["./..."])];
}

export interface GoTestCommandOptions {
  coverageProfile?: string;
  json?: boolean;
  packages?: string[];
}

export function createGoTestArgs(options: GoTestCommandOptions = {}): string[] {
  const args = ["test"];
  if (options.json ?? true) {
    args.push("-json");
  }
  if (options.coverageProfile !== undefined) {
    args.push(`-coverprofile=${options.coverageProfile}`);
  }
  args.push(...(options.packages ?? ["./..."]));
  return args;
}

export interface GoCoverageArgsOptions {
  func: string;
}

export function createGoCoverageArgs(options: GoCoverageArgsOptions): string[] {
  return ["tool", "cover", `-func=${options.func}`];
}

export interface GofmtCommandOptions {
  files: string[];
}

export function createGofmtArgs(options: GofmtCommandOptions): string[] {
  return ["-l", ...options.files];
}
