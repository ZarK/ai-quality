import path from "node:path";

import { readIntegerString } from "./utils.js";

export interface LizardMetricsFileMetrics {
  blockCount: number;
  blocks: LizardMetricsBlock[];
  maintainability: {
    rank: string;
    score: number;
  };
  maxComplexity: {
    rank: string;
    score: number;
  };
  raw: {
    sloc: number;
  };
}

export interface LizardMetricsBlock {
  complexity: number;
  file: string;
  name: string;
  nloc: number;
  parameterCount: number;
  startLine: number;
}

export async function parseLizardMetrics(
  output: string,
  cwd: string,
  selectedFiles: readonly string[],
): Promise<Record<string, LizardMetricsFileMetrics>> {
  const rows = output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => parseCsvLine(line));
  const rowMetrics = new Map<string, LizardMetricsBlock[]>();

  for (const row of rows) {
    const nloc = readIntegerString(row[0]);
    const complexity = readIntegerString(row[1]);
    const parameterCount = readIntegerString(row[3]);
    const file = row[6] === undefined ? undefined : path.resolve(cwd, row[6]);
    const name = row[7] ?? "<anonymous>";
    const startLine = readIntegerString(row[9]) ?? 1;
    if (
      nloc === undefined ||
      complexity === undefined ||
      parameterCount === undefined ||
      file === undefined
    ) {
      continue;
    }

    const block = { complexity, file, name, nloc, parameterCount, startLine };
    const existingRows = rowMetrics.get(file);
    if (existingRows === undefined) {
      rowMetrics.set(file, [block]);
      continue;
    }
    existingRows.push(block);
  }

  const files = await Promise.all(
    selectedFiles.map(async (file) => {
      const blocks = rowMetrics.get(file) ?? [];
      const sloc = blocks.reduce((total, block) => total + block.nloc, 0);
      const maxComplexity = blocks.reduce((max, block) => Math.max(max, block.complexity), 0);
      const maintainabilityScore = clampNumber(
        100 -
          Math.log(sloc + 1) * 12 -
          Math.max(1, maxComplexity) * 5 -
          Math.max(0, blocks.length - 1) * 1.5,
        0,
        100,
      );

      return [
        file,
        {
          blockCount: blocks.length,
          blocks,
          maintainability: {
            rank: rankMaintainabilityScore(maintainabilityScore),
            score: maintainabilityScore,
          },
          maxComplexity: {
            rank: rankComplexityScore(maxComplexity),
            score: maxComplexity,
          },
          raw: { sloc },
        } satisfies LizardMetricsFileMetrics,
      ] as const;
    }),
  );

  return Object.fromEntries(files);
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }
    current += char ?? "";
  }
  values.push(current);
  return values;
}

function rankComplexityScore(score: number): string {
  if (score <= 5) {
    return "A";
  }
  if (score <= 10) {
    return "B";
  }
  if (score <= 20) {
    return "C";
  }
  if (score <= 30) {
    return "D";
  }
  return "E";
}

function rankMaintainabilityScore(score: number): string {
  if (score >= 80) {
    return "A";
  }
  if (score >= 60) {
    return "B";
  }
  if (score >= 40) {
    return "C";
  }
  if (score >= 20) {
    return "D";
  }
  return "E";
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
