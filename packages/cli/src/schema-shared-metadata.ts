import type { ExitCodeMetadata, FlagMetadata } from "@tjalve/qube-cli";

export const stageSelectionFlags = [
  {
    name: "up-to",
    description: "Run every ladder stage from 0 through the provided stage index.",
    type: "integer",
  },
  {
    name: "only",
    description: "Run one numeric ladder stage.",
    type: "integer",
  },
  {
    name: "stage",
    description: "Run one named stage.",
    type: "string",
  },
  {
    name: "profile",
    description: "Select the configured AIQ profile.",
    type: "option",
    options: ["fast", "standard", "deep"],
  },
] as const satisfies readonly FlagMetadata[];

export const manifestFlags = [
  {
    name: "files",
    description: "Add explicit input files or paths to the run manifest.",
    type: "string",
    multiple: true,
  },
  {
    name: "files-from",
    description: "Read newline-delimited input files from a path.",
    type: "string",
  },
  {
    name: "stdin-file-list",
    description: "Read newline-delimited input files from standard input.",
    type: "boolean",
  },
] as const satisfies readonly FlagMetadata[];

export const outputFlags = [
  {
    name: "format",
    description: "Select text or JSON output.",
    type: "option",
    options: ["text", "json"],
    defaultValue: "text",
  },
] as const satisfies readonly FlagMetadata[];

export const commonExitCodes = [
  {
    code: 0,
    category: "success",
    description: "The command completed successfully.",
  },
  {
    code: 1,
    category: "validation",
    description: "The quality run completed and reported quality failures.",
  },
  {
    code: 2,
    category: "usage",
    description: "The command line, configuration, or selected project inputs were invalid.",
  },
  {
    code: 3,
    category: "unexpected",
    description: "AIQ hit an internal or host runtime error.",
  },
] as const satisfies readonly ExitCodeMetadata[];
