export interface BiomeLintCommandOptions {
  configPath?: string;
  files: string[];
}

export function createBiomeLintArgs(options: BiomeLintCommandOptions): string[] {
  return [
    "lint",
    ...(options.configPath === undefined ? [] : [`--config-path=${options.configPath}`]),
    "--reporter=json",
    ...options.files,
  ];
}

export interface BiomeFormatCommandOptions {
  configPath?: string;
  files: string[];
}

export function createBiomeFormatArgs(options: BiomeFormatCommandOptions): string[] {
  return [
    "format",
    ...(options.configPath === undefined ? [] : [`--config-path=${options.configPath}`]),
    "--reporter=json",
    ...options.files,
  ];
}
