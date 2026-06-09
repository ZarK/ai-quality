export type ExecFileError = NodeJS.ErrnoException & {
  code?: number | string;
  signal?: NodeJS.Signals | null;
  stderr?: string;
  stdout?: string;
};

export interface ToolRunOutcome {
  durationMs: number;
  exitCode: number | undefined;
  finishedAt: string;
  startedAt: string;
  stderr: string;
  stdout: string;
}

export interface ToolRunOptions {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  maxBuffer?: number;
  signal?: AbortSignal;
}
