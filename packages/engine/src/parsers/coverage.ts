import { readIntegerString, readNestedValue } from "./utils.js";
import { parseXmlAttributes } from "./xml.js";

export function readCoberturaLineRate(reportContents: string | undefined): number | undefined {
  if (reportContents === undefined) {
    return undefined;
  }

  const match = /<coverage[^>]*line-rate="([0-9.]+)"/u.exec(reportContents);
  if (match?.[1] === undefined) {
    return undefined;
  }

  const rate = Number.parseFloat(match[1]);
  if (!Number.isFinite(rate)) {
    return undefined;
  }

  return rate <= 1 ? rate * 100 : rate;
}

export function readJacocoLineRate(reportContents: string | undefined): number | undefined {
  if (reportContents === undefined) {
    return undefined;
  }

  const lineMatches = [...reportContents.matchAll(/<counter\b([^>]*)\/?>/gu)]
    .map((match) => parseXmlAttributes(match[1] ?? ""))
    .filter((attributes) => (attributes.type ?? "").toUpperCase() === "LINE");
  const rootCounter = lineMatches.at(-1);
  if (rootCounter === undefined) {
    return undefined;
  }

  const covered = readIntegerString(rootCounter.covered) ?? 0;
  const missed = readIntegerString(rootCounter.missed) ?? 0;
  const total = missed + covered;
  if (total === 0) {
    return undefined;
  }

  return (covered / total) * 100;
}

export function readLcovLineRate(reportContents: string | undefined): number | undefined {
  if (reportContents === undefined) {
    return undefined;
  }

  const totals = { foundData: false, linesFound: 0, linesHit: 0 };
  for (const line of reportContents.split(/\r?\n/u)) {
    addLcovLineTotals(totals, line);
  }

  if (!totals.foundData || totals.linesFound === 0) {
    return undefined;
  }

  return (totals.linesHit / totals.linesFound) * 100;
}

function addLcovLineTotals(
  totals: { foundData: boolean; linesFound: number; linesHit: number },
  line: string,
): void {
  if (line.startsWith("LF:")) {
    totals.linesFound += readIntegerString(line.slice(3)) ?? 0;
    totals.foundData = true;
    return;
  }

  if (line.startsWith("LH:")) {
    totals.linesHit += readIntegerString(line.slice(3)) ?? 0;
    totals.foundData = true;
  }
}

export function readCoverageMetric(
  summary: Record<string, unknown> | undefined,
  ...keys: string[]
): number | undefined {
  if (summary === undefined) {
    return undefined;
  }

  const value = readNestedValue(summary, keys);
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
