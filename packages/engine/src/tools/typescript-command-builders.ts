export interface TscCommandOptions {
  noEmit?: boolean;
  pretty?: boolean;
  project: string;
}

export function createTscArgs(options: TscCommandOptions): string[] {
  return [
    ...((options.noEmit ?? true) ? ["--noEmit"] : []),
    ...((options.pretty ?? false) ? [] : ["--pretty", "false"]),
    "--project",
    options.project,
  ];
}
