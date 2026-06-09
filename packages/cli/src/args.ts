import { type AiqProfileName, aiqProfileNames } from "@tjalve/aiq/config";
import {
  collectTrailingFiles,
  isImplicitFirstRun,
  isSetupGuidanceCommand,
  parseBenchmarkKind,
  parseCommand,
  parseIntegerFlag,
  parseStageIdFlag,
  parseStageIndexFlag,
  requireValue,
  resolveCliStageShortcut,
  resolveCliStagesUpTo,
  resolveCommandToken,
} from "./args-helpers.js";
import { validateParsedArgs } from "./args-validation.js";
import {
  type CommandName,
  type ParsedArgs,
  defaultServeHost,
  defaultServePort,
  defaultWatchDebounceMs,
} from "./types.js";

export function parseArgs(argv: string[], cwd = process.cwd()): ParsedArgs {
  const args = argv.slice(2);
  while (args[0] === "--") {
    args.shift();
  }
  const isFirstRun = isImplicitFirstRun(args, cwd);
  const commandToken = isFirstRun ? undefined : resolveCommandToken(args[0], cwd);
  const command: CommandName = isFirstRun ? "first-run" : parseCommand(commandToken);
  const startIndex = commandToken === undefined ? 0 : 1;

  const parsed: ParsedArgs = {
    benchmarkKinds: [],
    benchmarkScenarioIds: [],
    benchmarkTags: [],
    command,
    configPrint: false,
    debounceMs: defaultWatchDebounceMs,
    diffOnly: false,
    dryRun: false,
    files: [],
    format: "text",
    help: args.includes("--help") || args.includes("-h"),
    host: defaultServeHost,
    port: defaultServePort,
    stages: [],
    stdinFileList: false,
    verbose: false,
  };

  for (let index = startIndex; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined) {
      continue;
    }

    if (argument === "--help" || argument === "-h") {
      parsed.help = true;
      continue;
    }

    if (argument === "--diff-only") {
      parsed.diffOnly = true;
      continue;
    }

    if (argument === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }

    if (argument === "--verbose" || argument === "-v") {
      parsed.verbose = true;
      continue;
    }

    if (argument === "--format") {
      const value = args[++index];
      if (value !== "json" && value !== "text") {
        throw new Error(`Unsupported format: ${value ?? "<missing>"}`);
      }
      parsed.format = value;
      continue;
    }

    if (argument === "--out-dir") {
      parsed.outDir = requireValue(argument, args[++index]);
      continue;
    }

    if (argument === "--print-config") {
      parsed.configPrint = true;
      continue;
    }

    if (argument === "--set-stage") {
      parsed.configSetStage = parseStageIndexFlag(argument, args[++index]);
      continue;
    }

    if (argument === "--corpus-root") {
      parsed.benchmarkCorpusRoot = requireValue(argument, args[++index]);
      continue;
    }

    if (argument === "--scenario") {
      parsed.benchmarkScenarioIds.push(requireValue(argument, args[++index]));
      continue;
    }

    if (argument === "--tag") {
      parsed.benchmarkTags.push(requireValue(argument, args[++index]));
      continue;
    }

    if (argument === "--kind") {
      parsed.benchmarkKinds.push(parseBenchmarkKind(argument, args[++index]));
      continue;
    }

    if (argument === "--stage") {
      parsed.stages.push(parseStageIdFlag(argument, args[++index]));
      continue;
    }

    if (argument === "--only") {
      parsed.stages.push(resolveCliStageShortcut(argument, args[++index]));
      continue;
    }

    if (argument === "--up-to") {
      parsed.stages.push(...resolveCliStagesUpTo(argument, args[++index]));
      continue;
    }

    if (argument === "--profile") {
      const profile = requireValue(argument, args[++index]);
      if (!aiqProfileNames.includes(profile as AiqProfileName)) {
        throw new Error(`Unsupported profile: ${profile}`);
      }
      parsed.profile = profile as AiqProfileName;
      continue;
    }

    if (argument === "--debounce-ms") {
      parsed.debounceMs = parseIntegerFlag(argument, args[++index]);
      continue;
    }

    if (argument === "--host") {
      parsed.host = requireValue(argument, args[++index]);
      continue;
    }

    if (argument === "--port") {
      parsed.port = parseIntegerFlag(argument, args[++index]);
      continue;
    }

    if (argument === "--files") {
      index = collectTrailingFiles(args, index + 1, parsed.files);
      continue;
    }

    if (argument === "--files-from") {
      parsed.filesFrom = requireValue(argument, args[++index]);
      continue;
    }

    if (argument === "--stdin-file-list") {
      parsed.stdinFileList = true;
      continue;
    }

    if (argument.startsWith("--")) {
      throw new Error(`Unknown option: ${argument}`);
    }

    if (isSetupGuidanceCommand(parsed.command) && parsed.setupSubcommand === undefined) {
      parsed.setupSubcommand = argument;
      continue;
    }

    parsed.files.push(argument);
  }

  validateParsedArgs(parsed, args);
  return parsed;
}
