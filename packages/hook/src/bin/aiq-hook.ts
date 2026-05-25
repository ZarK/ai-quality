#!/usr/bin/env node
import { stderr, stdout } from "node:process";

import { formatRunResultAsText } from "@tjalve/aiq-reporters";

import { runAiqHook } from "../index.js";

const helpText = `AIQ hook adapter

Usage:
  aiq-hook
`;

async function main(argv: string[]): Promise<number> {
  if (argv.includes("--help") || argv.includes("-h")) {
    stdout.write(helpText);
    return 0;
  }

  try {
    const result = await runAiqHook();
    if (result.skipped || result.result === undefined) {
      stdout.write("AIQ hook skipped: no staged files selected.\n");
      return 0;
    }

    stdout.write(formatRunResultAsText(result.result));
    return result.exitCode;
  } catch (error) {
    stderr.write(`${formatError(error)}\n`);
    return 1;
  }
}

process.exitCode = await main(process.argv);

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
