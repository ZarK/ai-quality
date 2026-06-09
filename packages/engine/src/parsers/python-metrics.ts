import { readNumber, readString } from "./utils.js";

export function parsePythonMetrics(output: string): Record<string, PythonMetricsFileMetrics> {
  const trimmed = output.trim();
  if (trimmed.length === 0) {
    throw new Error("Radon produced no JSON metrics output.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error(`Failed to parse radon JSON output: ${readOutputSnippet(trimmed)}`);
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Radon metrics output was not a JSON object.");
  }

  const results: Record<string, PythonMetricsFileMetrics> = {};
  for (const [file, value] of Object.entries(parsed as Record<string, unknown>)) {
    const metrics = readPythonFileMetrics(value);
    if (metrics !== undefined) {
      results[file] = metrics;
    }
  }

  return results;
}

function readPythonFileMetrics(value: unknown): PythonMetricsFileMetrics | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const readabilityRecord = readOptionalRecord(record.readability);
  return {
    cc: readPythonComplexityEntries(record.cc),
    mi: readPythonMaintainabilityMetrics(readOptionalRecord(record.mi)),
    raw: readPythonRawMetrics(readOptionalRecord(record.raw)),
    ...(readabilityRecord === undefined
      ? {}
      : {
          readability: {
            score: readNumber(readabilityRecord.score) ?? 0,
          },
        }),
  };
}

function readPythonComplexityEntries(value: unknown): PythonMetricsFileMetrics["cc"] {
  return Array.isArray(value)
    ? value.flatMap((entry) => {
        const block = readOptionalRecord(entry);
        return block === undefined ? [] : readPythonComplexityEntry(block);
      })
    : [];
}

function readPythonComplexityEntry(block: Record<string, unknown>): PythonMetricsFileMetrics["cc"] {
  const entry = {
    complexity: readNumber(block.complexity),
    endline: readNumber(block.endline),
    lineno: readNumber(block.lineno),
    name: readString(block, "name"),
    rank: readString(block, "rank"),
    type: readString(block, "type"),
  };
  return Object.values(entry).some((value) => value === undefined)
    ? []
    : [entry as PythonMetricsFileMetrics["cc"][number]];
}

function readPythonMaintainabilityMetrics(
  miRecord: Record<string, unknown> | undefined,
): PythonMetricsFileMetrics["mi"] {
  return {
    rank: readString(miRecord ?? {}, "rank") ?? "A",
    score: readNumber(miRecord?.score) ?? 0,
  };
}

function readPythonRawMetrics(
  rawRecord: Record<string, unknown> | undefined,
): PythonMetricsFileMetrics["raw"] {
  return {
    blank: readPythonRawMetric(rawRecord, "blank"),
    comments: readPythonRawMetric(rawRecord, "comments"),
    lloc: readPythonRawMetric(rawRecord, "lloc"),
    loc: readPythonRawMetric(rawRecord, "loc"),
    multi: readPythonRawMetric(rawRecord, "multi"),
    singleComments: readPythonRawMetric(rawRecord, "singleComments"),
    sloc: readPythonRawMetric(rawRecord, "sloc"),
  };
}

function readPythonRawMetric(
  rawRecord: Record<string, unknown> | undefined,
  key: keyof PythonMetricsFileMetrics["raw"],
): number {
  return readNumber(rawRecord?.[key]) ?? 0;
}

function readOptionalRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

export interface PythonMetricsFileMetrics {
  cc: Array<{
    complexity: number;
    endline: number;
    lineno: number;
    name: string;
    rank: string;
    type: string;
  }>;
  mi: {
    rank: string;
    score: number;
  };
  raw: {
    blank: number;
    comments: number;
    lloc: number;
    loc: number;
    multi: number;
    singleComments: number;
    sloc: number;
  };
  readability?: {
    score: number;
  };
}

export function readOutputSnippet(output: string): string {
  const normalized = output.replace(/\s+/gu, " ").trim();
  if (normalized.length <= 160) {
    return normalized;
  }

  return `${normalized.slice(0, 157)}...`;
}
