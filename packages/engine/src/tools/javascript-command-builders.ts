export interface JavaScriptTestArgsOptions {
  coverageDirectory: string;
  mode: "coverage" | "unit";
  reportPath: string;
  runner: "jest" | "vitest";
}

export function createPlaywrightTestArgs(options: { configPath?: string } = {}): string[] {
  return [
    "test",
    ...(options.configPath === undefined ? [] : ["--config", options.configPath]),
    "--reporter=json",
  ];
}

export function createDirectJavaScriptTestArgs(options: JavaScriptTestArgsOptions): string[] {
  const { coverageDirectory, mode, reportPath, runner } = options;

  if (runner === "vitest") {
    const args = [
      "--passWithNoTests",
      "--reporter=json",
      `--outputFile=${reportPath}`,
      "--run",
      "--pool=threads",
      "--poolOptions.threads.maxThreads=1",
      "--poolOptions.threads.minThreads=1",
      "--no-file-parallelism",
    ];
    if (mode === "coverage") {
      args.push(
        "--coverage",
        "--coverage.provider=v8",
        `--coverage.reportsDirectory=${coverageDirectory}`,
        "--coverage.reporter=json-summary",
      );
    }

    return args;
  }

  const args = ["--passWithNoTests", "--runInBand", "--json", `--outputFile=${reportPath}`];
  if (mode === "coverage") {
    args.push(
      "--coverage",
      `--coverageDirectory=${coverageDirectory}`,
      "--coverageReporters=json-summary",
    );
  }

  return args;
}

export function createJavaScriptTestArgs(options: JavaScriptTestArgsOptions): string[] {
  return ["test", "--", ...createDirectJavaScriptTestArgs(options)];
}
