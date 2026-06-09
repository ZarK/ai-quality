export type SharedFileMetricSummary = {
  blockCount: number;
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
};

export type SharedMetricsTotals = {
  maxComplexity: number;
  maxRank: string;
  minMaintainability: number;
  minMaintainabilityRank: string;
  scannedFileCount: number;
  totalBlocks: number;
  totalSloc: number;
};

export function createSharedMetricsTotals(): SharedMetricsTotals {
  return {
    maxComplexity: 0,
    maxRank: "A",
    minMaintainability: Number.POSITIVE_INFINITY,
    minMaintainabilityRank: "A",
    scannedFileCount: 0,
    totalBlocks: 0,
    totalSloc: 0,
  };
}

export function addSharedFileMetrics(
  totals: SharedMetricsTotals,
  files: Record<string, SharedFileMetricSummary>,
): void {
  totals.scannedFileCount += Object.keys(files).length;

  for (const fileMetrics of Object.values(files)) {
    totals.totalSloc += fileMetrics.raw.sloc;
    totals.totalBlocks += fileMetrics.blockCount;
    addSharedComplexity(totals, fileMetrics);
    addSharedMaintainability(totals, fileMetrics);
  }
}

function addSharedComplexity(
  totals: SharedMetricsTotals,
  fileMetrics: SharedFileMetricSummary,
): void {
  if (fileMetrics.maxComplexity.score <= totals.maxComplexity) {
    return;
  }

  totals.maxComplexity = fileMetrics.maxComplexity.score;
  totals.maxRank = fileMetrics.maxComplexity.rank;
}

function addSharedMaintainability(
  totals: SharedMetricsTotals,
  fileMetrics: SharedFileMetricSummary,
): void {
  if (fileMetrics.maintainability.score >= totals.minMaintainability) {
    return;
  }

  totals.minMaintainability = fileMetrics.maintainability.score;
  totals.minMaintainabilityRank = fileMetrics.maintainability.rank;
}

export type PythonFileMetricSummary = {
  cc: Array<{
    complexity: number;
    rank: string;
  }>;
  mi: {
    rank: string;
    score: number;
  };
  raw: {
    sloc: number;
  };
};

export function addPythonFileMetrics(
  totals: SharedMetricsTotals,
  files: Record<string, PythonFileMetricSummary>,
): void {
  totals.scannedFileCount += Object.keys(files).length;

  for (const fileMetrics of Object.values(files)) {
    totals.totalSloc += fileMetrics.raw.sloc;
    totals.totalBlocks += fileMetrics.cc.length;
    addPythonComplexity(totals, fileMetrics);
    addPythonMaintainability(totals, fileMetrics);
  }
}

function addPythonComplexity(
  totals: SharedMetricsTotals,
  fileMetrics: PythonFileMetricSummary,
): void {
  for (const block of fileMetrics.cc) {
    if (block.complexity > totals.maxComplexity) {
      totals.maxComplexity = block.complexity;
      totals.maxRank = block.rank;
    }
  }
}

function addPythonMaintainability(
  totals: SharedMetricsTotals,
  fileMetrics: PythonFileMetricSummary,
): void {
  if (fileMetrics.mi.score >= totals.minMaintainability) {
    return;
  }

  totals.minMaintainability = fileMetrics.mi.score;
  totals.minMaintainabilityRank = fileMetrics.mi.rank;
}

export function resolveMetricsStageStatus(
  diagnosticCount: number,
  unsupportedFileCount: number,
): "failed" | "not_implemented" | "passed" {
  if (diagnosticCount > 0) {
    return "failed";
  }

  return unsupportedFileCount > 0 ? "not_implemented" : "passed";
}
