import type { DotNetMetricsFileMetrics } from "./dotnet-metrics-tools.js";
import {
  clampNumber,
  countMatches,
  rankComplexityScore,
  rankMaintainabilityScore,
} from "./dotnet-source-metric-utils.js";
import {
  countDotNetTernaryOperators,
  stripDotNetComments,
  stripDotNetCommentsAndLiterals,
} from "./dotnet-source-scanner.js";

const methodPattern =
  /^[ \t]*(?:\[[^\]]+\]\s*)*(?:(?:public|private|protected|internal|static|sealed|virtual|override|async|extern|unsafe|new|partial)\s+)*(?:(?!(?:public|private|protected|internal|static|sealed|virtual|override|async|extern|unsafe|new|partial)\b)[A-Za-z_][\w<>,?.\[\]]*\s+)+[A-Za-z_][\w]*\s*\([^;{}]*\)\s*(?:where\b[^\{]+)?\{/gmu;
const constructorPattern =
  /^[ \t]*(?:\[[^\]]+\]\s*)*(?:(?:public|private|protected|internal|static|extern|unsafe)\s+)+[A-Za-z_][\w]*\s*\([^;{}]*\)\s*(?::\s*(?:base|this)\s*\([^;{}]*\)\s*)?\{/gmu;
const decisionPatterns = [
  /\bif\b/gu,
  /\bfor\b/gu,
  /\bforeach\b/gu,
  /\bwhile\b/gu,
  /\bcase\b/gu,
  /\bcatch\b/gu,
  /&&/gu,
  /\|\|/gu,
] as const;

export async function readDotNetFileMetrics(source: string): Promise<DotNetMetricsFileMetrics> {
  const stripped = stripDotNetComments(source);
  const sloc = countDotNetSloc(stripped);
  const blockCount = countDotNetBlocks(stripped);
  const decisionCount = countDotNetDecisions(source);
  const maxComplexityScore =
    blockCount === 0 ? 0 : Math.max(1, Math.ceil((decisionCount + blockCount) / blockCount));
  const maintainabilityScore = clampNumber(
    100 - Math.log(sloc + 1) * 12 - maxComplexityScore * 5 - Math.max(0, blockCount - 1) * 1.5,
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

function countDotNetSloc(stripped: string): number {
  return stripped
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0).length;
}

function countDotNetBlocks(stripped: string): number {
  return countMatches(stripped, methodPattern) + countMatches(stripped, constructorPattern);
}

function countDotNetDecisions(source: string): number {
  const decisionText = stripDotNetCommentsAndLiterals(source);
  const keywordDecisions = decisionPatterns.reduce(
    (count, pattern) => count + countMatches(decisionText, pattern),
    0,
  );

  return keywordDecisions + countDotNetTernaryOperators(decisionText);
}
