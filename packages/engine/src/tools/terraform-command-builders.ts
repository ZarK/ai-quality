export interface TerraformFmtCommandOptions {
  check?: boolean;
  files?: string[];
}

export function createTerraformFmtArgs(options: TerraformFmtCommandOptions = {}): string[] {
  const args = ["fmt"];
  if (options.check ?? true) {
    args.push("-check");
  }
  if (options.files !== undefined && options.files.length > 0) {
    args.push(...options.files);
  }
  return args;
}

export interface TerraformInitCommandOptions {
  disableBackend?: boolean;
  disableInput?: boolean;
  noColor?: boolean;
}

export function createTerraformInitArgs(options: TerraformInitCommandOptions = {}): string[] {
  const args = ["init"];
  if (options.disableBackend ?? false) {
    args.push("-backend=false");
  }
  if (options.disableInput ?? false) {
    args.push("-input=false");
  }
  if (options.noColor ?? true) {
    args.push("-no-color");
  }
  return args;
}

export interface TerraformValidateCommandOptions {
  json?: boolean;
  noColor?: boolean;
}

export function createTerraformValidateArgs(
  options: TerraformValidateCommandOptions = {},
): string[] {
  return [
    "validate",
    ...((options.json ?? true) ? ["-json"] : []),
    ...((options.noColor ?? true) ? ["-no-color"] : []),
  ];
}
