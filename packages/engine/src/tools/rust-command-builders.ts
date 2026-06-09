export interface CargoClippyCommandOptions {
  workspace?: boolean;
}

export function createCargoClippyArgs(options: CargoClippyCommandOptions = {}): string[] {
  return [
    "clippy",
    ...((options.workspace ?? true) ? ["--workspace"] : []),
    "--all-targets",
    "--message-format=json",
    "--",
    "-D",
    "warnings",
  ];
}

export interface CargoCheckCommandOptions {
  workspace?: boolean;
}

export function createCargoCheckArgs(options: CargoCheckCommandOptions = {}): string[] {
  return [
    "check",
    ...((options.workspace ?? true) ? ["--workspace"] : []),
    "--all-targets",
    "--message-format=json",
  ];
}

export interface CargoFmtCommandOptions {
  all?: boolean;
  check?: boolean;
}

export function createCargoFmtArgs(options: CargoFmtCommandOptions = {}): string[] {
  const args = ["fmt"];
  if (options.all ?? true) {
    args.push("--all");
  }
  if (options.check ?? true) {
    args.push("--check");
  }
  return args;
}

export interface CargoTestCommandOptions {
  json?: boolean;
  workspace?: boolean;
}

export function createCargoTestArgs(options: CargoTestCommandOptions = {}): string[] {
  return [
    "test",
    ...((options.workspace ?? true) ? ["--workspace"] : []),
    ...((options.json ?? true) ? ["--message-format=json"] : []),
  ];
}

export interface CargoLlvmCovCommandOptions {
  lcovPath?: string;
  workspace?: boolean;
}

export function createCargoLlvmCovArgs(options: CargoLlvmCovCommandOptions = {}): string[] {
  const args = ["llvm-cov"];
  if (options.workspace ?? true) {
    args.push("--workspace");
  }
  if (options.lcovPath !== undefined) {
    args.push("--lcov", "--output-path", options.lcovPath);
  }
  return args;
}
