export interface PythonTestArgsOptions {
  coveragePath: string;
  junitPath: string;
  mode: "coverage" | "unit";
}

export function createPythonTestArgs(options: PythonTestArgsOptions): string[] {
  const { coveragePath, junitPath, mode } = options;
  const args = ["-m", "pytest", "--junitxml", junitPath, "-q"];
  if (mode === "coverage") {
    args.push("-p", "pytest_cov", "--cov=.", "--cov-report", `json:${coveragePath}`);
  }

  return args;
}
