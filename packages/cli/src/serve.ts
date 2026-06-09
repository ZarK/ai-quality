import { type Server, createServer } from "node:http";

import { writeServeListeningOutput } from "./output.js";
import { handleServeRequest } from "./serve-request.js";
import { closeServer, listenServer } from "./serve-server.js";
import type { ServeRunLock } from "./serve-types.js";
import { createActiveSignal, formatError, isCliCancellation, waitForAbort } from "./shared.js";
import type { CliIo, CliRunOptions, ParsedArgs } from "./types.js";

export async function runServeCommand(
  parsed: ParsedArgs,
  io: CliIo,
  options: CliRunOptions,
): Promise<number> {
  const activeSignal = createActiveSignal(options.signal);
  const runLock: ServeRunLock = { active: false };
  let server: Server | undefined;

  try {
    server = createServer((request, response) => {
      void handleServeRequest(request, response, parsed, io, activeSignal.signal, runLock);
    });
    const address = await listenServer(server, parsed.host, parsed.port);
    writeServeListeningOutput(io, parsed.format, parsed.host, address.port);
    await waitForAbort(activeSignal.signal);
    await closeServer(server);
    return 0;
  } catch (error) {
    if (server !== undefined) {
      await closeServer(server).catch(() => undefined);
    }

    if (isCliCancellation(error, activeSignal.signal)) {
      return 0;
    }

    io.stderr.write(`${formatError(error)}\n`);
    return 1;
  } finally {
    activeSignal.cleanup();
  }
}
