import type { Diagnostic } from "../contracts.js";
import { parseGoCompilerDiagnostics, parseGoOutputDiagnosticLine } from "./go.js";
import { deduplicateDiagnostics, readString } from "./utils.js";

export function parseGoTestReport(
  output: string,
  cwd: string,
  source: string,
  fallbackFile: string,
): {
  diagnostics: Diagnostic[];
  summary: { failed: number; passed: number; total: number };
} {
  const diagnostics: Diagnostic[] = [];
  const testOutputs = new Map<string, string[]>();
  const packageOutputs = new Map<string, string[]>();
  let failed = 0;
  let passed = 0;
  let total = 0;

  for (const line of output.split(/\r?\n/u)) {
    const event = parseGoTestEvent(line, cwd);
    if (event === undefined) {
      continue;
    }

    appendGoTestOutput(event, packageOutputs, testOutputs);
    const result = applyGoTestEvent(event, testOutputs, packageOutputs, cwd, source, fallbackFile);
    total += result.total;
    passed += result.passed;
    failed += result.failed;
    diagnostics.push(...result.diagnostics);
  }

  const uniqueDiagnostics = deduplicateDiagnostics(diagnostics);
  if (total === 0 && uniqueDiagnostics.length > 0) {
    total = uniqueDiagnostics.length;
    failed = uniqueDiagnostics.length;
    passed = 0;
  }

  return {
    diagnostics: uniqueDiagnostics,
    summary: { failed, passed, total },
  };
}

function applyGoTestEvent(
  event: NonNullable<ReturnType<typeof parseGoTestEvent>>,
  testOutputs: Map<string, string[]>,
  packageOutputs: Map<string, string[]>,
  cwd: string,
  source: string,
  fallbackFile: string,
): { diagnostics: Diagnostic[]; failed: number; passed: number; total: number } {
  if (event.testName !== undefined && event.action === "pass") {
    return { diagnostics: [], failed: 0, passed: 1, total: 1 };
  }
  if (event.testName !== undefined && event.action === "fail") {
    return {
      diagnostics: [
        createGoTestFailureDiagnostic(
          event.testName,
          testOutputs.get(event.testKey) ?? [],
          cwd,
          source,
          fallbackFile,
        ),
      ],
      failed: 1,
      passed: 0,
      total: 1,
    };
  }
  return {
    diagnostics:
      event.testName === undefined && event.action === "fail"
        ? parseGoCompilerDiagnostics(
            (packageOutputs.get(event.packageKey) ?? []).join("\n"),
            cwd,
            source,
          )
        : [],
    failed: 0,
    passed: 0,
    total: 0,
  };
}

function parseGoTestEvent(
  line: string,
  cwd: string,
):
  | {
      action: string | undefined;
      outputLine: string | undefined;
      packageKey: string;
      testKey: string;
      testName: string | undefined;
    }
  | undefined {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const parsed = parseJsonRecord(trimmed);
  if (parsed === undefined) {
    return undefined;
  }

  const packageKey = readString(parsed, "Package") ?? cwd;
  const testName = readString(parsed, "Test");
  return {
    action: readString(parsed, "Action"),
    outputLine: readString(parsed, "Output")?.replace(/\r?\n$/u, ""),
    packageKey,
    testKey: `${packageKey}::${testName ?? ""}`,
    testName,
  };
}

function parseJsonRecord(value: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function appendGoTestOutput(
  event: NonNullable<ReturnType<typeof parseGoTestEvent>>,
  packageOutputs: Map<string, string[]>,
  testOutputs: Map<string, string[]>,
): void {
  if (event.outputLine === undefined || event.outputLine.length === 0) {
    return;
  }

  appendMapEntry(packageOutputs, event.packageKey, event.outputLine);
  if (event.testName !== undefined) {
    appendMapEntry(testOutputs, event.testKey, event.outputLine);
  }
}

function appendMapEntry(values: Map<string, string[]>, key: string, entry: string): void {
  const entries = values.get(key) ?? [];
  entries.push(entry);
  values.set(key, entries);
}

export function createGoTestFailureDiagnostic(
  testName: string,
  outputLines: readonly string[],
  cwd: string,
  source: string,
  fallbackFile: string,
): Diagnostic {
  const informativeLines = outputLines
    .map((line) => line.trimEnd())
    .filter(
      (line) =>
        line.trim().length > 0 &&
        !/^=== RUN/u.test(line.trim()) &&
        !/^--- (?:FAIL|PASS|SKIP):/u.test(line.trim()) &&
        !/^FAIL\b/u.test(line.trim()) &&
        !/^ok\s/u.test(line.trim()) &&
        !/^\?\s/u.test(line.trim()),
    );
  const locationDiagnostic = informativeLines
    .map((line) => parseGoOutputDiagnosticLine(line, cwd, source))
    .find((diagnostic) => diagnostic !== undefined);

  return {
    file: locationDiagnostic?.file ?? fallbackFile,
    message:
      informativeLines.length > 0
        ? `${testName}\n${informativeLines.join("\n")}`
        : `${testName} failed.`,
    ...(locationDiagnostic?.range === undefined ? {} : { range: locationDiagnostic.range }),
    severity: "error",
    source,
  };
}
