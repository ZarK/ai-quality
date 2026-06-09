export function countMatches(value: string, pattern: RegExp): number {
  return [...value.matchAll(pattern)].length;
}

export function rankComplexityScore(score: number): string {
  if (score <= 5) return "A";
  if (score <= 10) return "B";
  if (score <= 20) return "C";
  if (score <= 30) return "D";
  return "E";
}

export function rankMaintainabilityScore(score: number): string {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  if (score >= 20) return "D";
  return "E";
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
