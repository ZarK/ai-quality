import type { DotNetMetricsFileMetrics } from "./dotnet-metrics-tools.js";
import {
  clampNumber,
  countMatches,
  rankComplexityScore,
  rankMaintainabilityScore,
} from "./dotnet-source-metric-utils.js";
import { countDotNetTernaryOperators, stripDotNetComments } from "./dotnet-source-scanner.js";

export async function readDotNetFileMetrics(source: string): Promise<DotNetMetricsFileMetrics> {
  const stripped = stripDotNetComments(source);
  const codeLines = stripped
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const sloc = codeLines.length;
  const methodCount = countMatches(
    stripped,
    /^[ \t]*(?:\[[^\]]+\]\s*)*(?:(?:public|private|protected|internal|static|sealed|virtual|override|async|extern|unsafe|new|partial)\s+)*(?:[A-Za-z_][\w<>,?.\[\]]*\s+)+[A-Za-z_][\w]*\s*\([^;{}]*\)\s*(?:where\b[^\{]+)?\{/gmu,
  );
  const decisionCount =
    countMatches(stripped, /\bif\b/gu) +
    countMatches(stripped, /\bfor\b/gu) +
    countMatches(stripped, /\bforeach\b/gu) +
    countMatches(stripped, /\bwhile\b/gu) +
    countMatches(stripped, /\bcase\b/gu) +
    countMatches(stripped, /\bcatch\b/gu) +
    countMatches(stripped, /&&/gu) +
    countMatches(stripped, /\|\|/gu) +
    countDotNetTernaryOperators(stripped);
  const blockCount = methodCount;
  const maxComplexityScore =
    methodCount === 0 ? 0 : Math.max(1, Math.ceil((decisionCount + methodCount) / methodCount));
  const maintainabilityScore = clampNumber(
    100 - Math.log(sloc + 1) * 12 - maxComplexityScore * 5 - Math.max(0, methodCount - 1) * 1.5,
    0,
    100,
  );

  return {
    blockCount,
    maintainability: {
      rank: rankMaintainabilityScore(maintainabilityScore),
      score: maintainabilityScore,
    },
    maxComplexity: {
      rank: rankComplexityScore(maxComplexityScore),
      score: maxComplexityScore,
    },
    raw: { sloc },
  };
}
