export interface LizardCommandOptions {
  inputFile: string;
  languages: string[];
  workingThreads?: number;
}

export function createLizardArgs(options: LizardCommandOptions): string[] {
  const args = [
    "lizard",
    "--csv",
    ...options.languages.flatMap((lang) => ["-l", lang]),
    "--input_file",
    options.inputFile,
    "--working_threads",
    String(options.workingThreads ?? 1),
  ];
  return args;
}
