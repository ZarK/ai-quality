import type { RunResult } from "@tjalve/aiq/model";

import { formatRunResultOutput } from "./output-formatters.js";
import type {
  RunWorkflowOutput,
  ServeListeningEnvelope,
  WatchRunEnvelope,
} from "./output-types.js";
import type { CliIo, OutputFormat } from "./types.js";

export function writeWatchOutput(
  io: CliIo,
  format: OutputFormat,
  trigger: string,
  result: RunResult,
  workflow?: RunWorkflowOutput,
): void {
  if (format === "json") {
    const payload: WatchRunEnvelope = {
      event: "run",
      result,
      trigger,
      ...(workflow === undefined ? {} : { workflow }),
    };
    io.stdout.write(`${JSON.stringify(payload)}\n`);
    return;
  }

  const body = formatRunResultOutput("text", result, undefined, {
    ...(workflow === undefined ? {} : { workflow }),
  }).trimEnd();
  io.stdout.write(`AIQ watch (${trigger})\n${body}\n`);
}

export function writeServeListeningOutput(
  io: CliIo,
  format: OutputFormat,
  host: string,
  port: number,
): void {
  const url = `http://${formatServeHost(host)}:${port}`;
  if (format === "json") {
    const payload: ServeListeningEnvelope = {
      event: "listening",
      host,
      port,
      url,
    };
    io.stdout.write(`${JSON.stringify(payload)}\n`);
    return;
  }

  io.stdout.write(`AIQ serve listening on ${url}\n`);
}

function formatServeHost(host: string): string {
  if (host.startsWith("[") || !host.includes(":")) {
    return host;
  }

  return `[${host}]`;
}
