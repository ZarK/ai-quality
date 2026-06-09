import { createDoctorCommandOutput, createSetupCommandOutput } from "./doctor-output.js";
import { formatDoctorOutput, formatSetupOutput } from "./output.js";
import { formatError } from "./shared.js";
import type { CliIo, ParsedArgs } from "./types.js";

export async function runDoctorCommand(parsed: ParsedArgs, io: CliIo): Promise<number> {
  try {
    const output = await createDoctorCommandOutput(parsed, io);
    io.stdout.write(formatDoctorOutput(parsed.format, output));
    return output.ok ? 0 : 1;
  } catch (error) {
    io.stderr.write(`${formatError(error)}\n`);
    return 2;
  }
}

export async function runSetupCommand(parsed: ParsedArgs, io: CliIo): Promise<number> {
  try {
    const doctorOutput = await createDoctorCommandOutput(parsed, io);
    const output = createSetupCommandOutput(doctorOutput, parsed);
    io.stdout.write(formatSetupOutput(parsed.format, output));
    return output.ok ? 0 : 1;
  } catch (error) {
    io.stderr.write(`${formatError(error)}\n`);
    return 2;
  }
}
