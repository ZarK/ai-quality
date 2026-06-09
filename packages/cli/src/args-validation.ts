import { isSetupGuidanceCommand } from "./args-helpers.js";
import type { ParsedArgs } from "./types.js";
import { defaultServeHost, defaultServePort, defaultWatchDebounceMs } from "./types.js";

export function validateParsedArgs(parsed: ParsedArgs, args: string[]): void {
  validateGlobalOptionCompatibility(parsed);

  if (parsed.help) {
    return;
  }

  validateServeArgs(parsed);
  validateBenchArgs(parsed);
  validateConfigArgs(parsed);
  validateDoctorArgs(parsed);
  validateSetupArgs(parsed);
  validateEvidenceArgs(parsed, args);
  validateStatusArgs(parsed);
  validateSchemaArgs(parsed, args);

  if (isSetupGuidanceCommand(parsed.command)) {
    validateSetupGuidanceCommand(parsed);
  }
}

function validateGlobalOptionCompatibility(parsed: ParsedArgs): void {
  if (!hasCommandRejectedGlobalOption(parsed)) {
    return;
  }

  throw new Error(
    "--diff-only is only supported by run/check; --dry-run is supported by aiq and run/check; --verbose is supported by aiq, run/check, doctor, and setup.",
  );
}

function hasCommandRejectedGlobalOption(parsed: ParsedArgs): boolean {
  return (
    parsed.command !== "run" &&
    parsed.command !== "check" &&
    (parsed.diffOnly ||
      (parsed.dryRun && parsed.command !== "first-run") ||
      (parsed.verbose && !canUseVerbose(parsed.command)))
  );
}

function canUseVerbose(command: ParsedArgs["command"]): boolean {
  return command === "doctor" || command === "first-run" || command === "setup";
}

function validateServeArgs(parsed: ParsedArgs): void {
  if (
    parsed.command === "serve" &&
    (parsed.files.length > 0 ||
      parsed.filesFrom !== undefined ||
      parsed.setupSubcommand !== undefined ||
      parsed.stdinFileList)
  ) {
    throw new Error(
      "The serve command receives files per request and does not accept startup manifest inputs.",
    );
  }
}

function validateBenchArgs(parsed: ParsedArgs): void {
  if (
    parsed.command === "bench" &&
    (parsed.files.length > 0 ||
      parsed.filesFrom !== undefined ||
      parsed.setupSubcommand !== undefined ||
      parsed.stdinFileList ||
      parsed.stages.length > 0 ||
      parsed.profile !== undefined)
  ) {
    throw new Error(
      `The ${parsed.command} command manages its own corpus and only accepts benchmark filters plus output options.`,
    );
  }
}

function validateConfigArgs(parsed: ParsedArgs): void {
  if (parsed.command === "config") {
    if (hasConfigRejectedOption(parsed)) {
      throw new Error(
        "The config command only accepts --print-config, --set-stage, and --format options.",
      );
    }

    if (parsed.configPrint && parsed.configSetStage !== undefined) {
      throw new Error("Use either --print-config or --set-stage, not both.");
    }
    return;
  }

  if (parsed.configPrint || parsed.configSetStage !== undefined) {
    throw new Error("--print-config and --set-stage are only supported by the config command.");
  }
}

function validateDoctorArgs(parsed: ParsedArgs): void {
  if (parsed.command !== "doctor") {
    return;
  }

  if (hasDoctorSetupRejectedOption(parsed)) {
    throw new Error(
      "The doctor command accepts --format, --verbose, --up-to, --only, --stage, and --profile.",
    );
  }
}

function validateSetupArgs(parsed: ParsedArgs): void {
  if (parsed.command !== "setup") {
    return;
  }

  if (hasDoctorSetupRejectedOption(parsed)) {
    throw new Error(
      "The setup command accepts --format, --verbose, --up-to, --only, --stage, and --profile.",
    );
  }
}

function validateEvidenceArgs(parsed: ParsedArgs, args: string[]): void {
  if (parsed.command !== "evidence") {
    return;
  }

  if ((parsed.format !== "json" && args.includes("--format")) || hasNonJsonOnlyFormat(args)) {
    throw new Error("The evidence command only supports --format json.");
  }

  if (hasOnlyFormatFreeCommandOptions(parsed)) {
    parsed.format = "json";
    return;
  }

  throw new Error("The evidence command only accepts --format.");
}

function validateStatusArgs(parsed: ParsedArgs): void {
  if (parsed.command !== "status") {
    return;
  }

  if (!hasOnlyFormatFreeCommandOptions(parsed)) {
    throw new Error("The status command only accepts --format.");
  }
}

function validateSchemaArgs(parsed: ParsedArgs, args: string[]): void {
  if (parsed.command !== "schema") {
    return;
  }

  if ((parsed.format !== "json" && args.includes("--format")) || hasNonJsonOnlyFormat(args)) {
    throw new Error("The schema command only supports --format json.");
  }

  if (!hasOnlyFormatFreeCommandOptions(parsed)) {
    throw new Error("The schema command only accepts --format.");
  }

  parsed.format = "json";
}

function hasOnlyFormatFreeCommandOptions(parsed: ParsedArgs): boolean {
  return !hasAnyFreeCommandRejectedOption(parsed);
}

function validateSetupGuidanceCommand(parsed: ParsedArgs): void {
  if (hasSetupGuidanceRejectedOption(parsed)) {
    throw new Error(
      "Setup guidance commands only accept their documented subcommand and --format.",
    );
  }

  const expectedSubcommand =
    parsed.command === "hook" ? "install" : parsed.command === "ci" ? "setup" : "write";
  if (parsed.setupSubcommand !== expectedSubcommand) {
    throw new Error(`Use aiq ${parsed.command} ${expectedSubcommand}.`);
  }
}

function hasNonJsonOnlyFormat(args: string[]): boolean {
  return args.some((argument, index) => argument === "--format" && args[index + 1] !== "json");
}

function hasConfigRejectedOption(parsed: ParsedArgs): boolean {
  return hasAnyRejectedOption([
    hasInputOption(parsed),
    hasStageOrProfileOption(parsed),
    hasOutputOrBenchmarkOption(parsed),
    hasServerOption(parsed),
  ]);
}

function hasDoctorSetupRejectedOption(parsed: ParsedArgs): boolean {
  return hasAnyRejectedOption([
    hasInputOption(parsed),
    hasOutputOrBenchmarkOption(parsed),
    hasServerOption(parsed),
  ]);
}

function hasSetupGuidanceRejectedOption(parsed: ParsedArgs): boolean {
  return hasAnyRejectedOption([
    parsed.files.length > 0,
    parsed.filesFrom !== undefined,
    parsed.stdinFileList,
    hasStageOrProfileOption(parsed),
    hasOutputOrBenchmarkOption(parsed),
    hasServerOption(parsed),
  ]);
}

function hasAnyFreeCommandRejectedOption(parsed: ParsedArgs): boolean {
  return hasAnyRejectedOption([
    hasInputOption(parsed),
    hasStageOrProfileOption(parsed),
    hasOutputOrBenchmarkOption(parsed),
    parsed.configPrint,
    parsed.configSetStage !== undefined,
    hasServerOption(parsed),
  ]);
}

function hasInputOption(parsed: ParsedArgs): boolean {
  return hasAnyRejectedOption([
    parsed.files.length > 0,
    parsed.filesFrom !== undefined,
    parsed.setupSubcommand !== undefined,
    parsed.stdinFileList,
  ]);
}

function hasStageOrProfileOption(parsed: ParsedArgs): boolean {
  return hasAnyRejectedOption([parsed.stages.length > 0, parsed.profile !== undefined]);
}

function hasOutputOrBenchmarkOption(parsed: ParsedArgs): boolean {
  return hasAnyRejectedOption([
    parsed.outDir !== undefined,
    parsed.benchmarkCorpusRoot !== undefined,
    parsed.benchmarkScenarioIds.length > 0,
    parsed.benchmarkTags.length > 0,
    parsed.benchmarkKinds.length > 0,
  ]);
}

function hasServerOption(parsed: ParsedArgs): boolean {
  return hasAnyRejectedOption([
    parsed.debounceMs !== defaultWatchDebounceMs,
    parsed.host !== defaultServeHost,
    parsed.port !== defaultServePort,
  ]);
}

function hasAnyRejectedOption(options: boolean[]): boolean {
  return options.includes(true);
}
