import { readFile, stat } from "node:fs/promises";

import * as parsers from "../parsers/index.js";
import type { PythonMetricsFileMetrics } from "../parsers/python.js";
import * as binaries from "../tools/binary-resolver.js";
import * as commands from "../tools/command-builders.js";
import { findNearestPythonQualityConfig, readConfigFingerprint } from "../tools/native-config.js";
import type { PythonRunnerRuntime } from "./contracts.js";
import type { PythonMetricsProjectMetrics, PythonProject } from "./python-tool-types.js";

export async function getPythonMetricsProjectMetrics(
  project: PythonProject,
  runtime: PythonRunnerRuntime,
): Promise<{ cacheHit: boolean; metrics: PythonMetricsProjectMetrics }> {
  const manifestKey = createPythonMetricsManifestKey(project);
  const cacheKey = await createPythonMetricsCacheKey(project, manifestKey);
  const cached = await runtime.getCachedValue("metrics:python", manifestKey, cacheKey, () =>
    runPythonMetricsProjectTask(project, runtime),
  );

  return {
    cacheHit: cached.cacheHit,
    metrics: cached.value,
  };
}

function createPythonMetricsManifestKey(project: PythonProject): string {
  return `${project.projectRoot}:${[...project.files].sort().join("|")}`;
}

async function createPythonMetricsCacheKey(
  project: PythonProject,
  manifestKey = createPythonMetricsManifestKey(project),
): Promise<string> {
  const [configFingerprint, fileEntries] = await Promise.all([
    readPythonMetricsConfigFingerprint(project.files),
    Promise.all(
      [...project.files]
        .sort((left, right) => left.localeCompare(right))
        .map(async (file) => {
          const fileStats = await stat(file);
          return `${file}@${fileStats.size}:${fileStats.mtimeMs}`;
        }),
    ),
  ]);

  return `${manifestKey}:${configFingerprint}:${fileEntries.join("|")}`;
}

async function readPythonMetricsConfigFingerprint(files: readonly string[]): Promise<string> {
  const fingerprints = await Promise.all(
    [...files]
      .sort((left, right) => left.localeCompare(right))
      .map(async (file) => {
        const configPath = await findNearestPythonQualityConfig(file);
        return readConfigFingerprint(configPath);
      }),
  );

  return [...new Set(fingerprints)].join("|");
}

async function runPythonMetricsProjectTask(
  project: PythonProject,
  runtime: PythonRunnerRuntime,
): Promise<PythonMetricsProjectMetrics> {
  const script = [
    "import json, math, pathlib, re, sys",
    "from radon.complexity import cc_rank, cc_visit",
    "from radon.metrics import h_visit, mi_rank, mi_visit",
    "from radon.raw import analyze",
    "files = [str(pathlib.Path(value).resolve()) for value in sys.argv[1:]]",
    "result = {}",
    "for file_path in files:",
    "    source = pathlib.Path(file_path).read_text(encoding='utf8')",
    "    raw = analyze(source)",
    "    blocks = cc_visit(source)",
    "    mi_score = float(mi_visit(source, True))",
    "    halstead = h_visit(source).total",
    "    complexities = [block.complexity for block in blocks]",
    "    avg_cc = sum(complexities) / len(complexities) if complexities else 0",
    "    comment_ratio = raw.comments / raw.sloc if raw.sloc else 0",
    "    long_names = len([name for name in re.findall(r'\\b[_a-zA-Z]\\w*\\b', source) if len(name) > 20])",
    "    vague_names = len(re.findall(r'\\b(data|info|item|obj|temp|tmp|val|var|thing|stuff|helper|util|manager|handler|service|processor|controller)\\b', source, re.IGNORECASE))",
    "    redundant_prefixes = len(re.findall(r'\\b(current_|new_|old_|temp_|tmp_|get_|set_|do_|make_|create_|build_)\\w+\\b', source))",
    "    vocabulary_density = (halstead.h1 + halstead.h2) / max(raw.sloc, 1)",
    "    readability_score = (",
    "        100",
    "        - 1.5 * math.log10(max(halstead.volume, 1))",
    "        - 1.2 * halstead.difficulty",
    "        - 0.6 * avg_cc",
    "        - 0.05 * raw.sloc",
    "        - 30 * max(comment_ratio - 0.25, 0)",
    "        - 2 * long_names",
    "        - 3 * vague_names",
    "        - 2 * redundant_prefixes",
    "        - 10 * max(vocabulary_density - 2, 0)",
    "    )",
    "    result[file_path] = {",
    "        'raw': {",
    "            'blank': raw.blank,",
    "            'comments': raw.comments,",
    "            'lloc': raw.lloc,",
    "            'loc': raw.loc,",
    "            'multi': raw.multi,",
    "            'singleComments': raw.single_comments,",
    "            'sloc': raw.sloc,",
    "        },",
    "        'cc': [",
    "            {",
    "                'complexity': block.complexity,",
    "                'endline': block.endline,",
    "                'lineno': block.lineno,",
    "                'name': block.name,",
    "                'rank': cc_rank(block.complexity),",
    "                'type': block.__class__.__name__,",
    "            }",
    "            for block in blocks",
    "        ],",
    "        'mi': {",
    "            'rank': mi_rank(mi_score),",
    "            'score': mi_score,",
    "        },",
    "        'readability': {",
    "            'score': readability_score,",
    "        },",
    "    }",
    "print(json.dumps(result))",
  ].join("\n");
  const args = ["-c", script, ...project.files];
  const outcome = await runtime.runExecutable(
    binaries.resolvePythonCommand(),
    args,
    project.projectRoot,
    runtime.signal,
  );

  if (outcome.exitCode !== 0) {
    throw new Error(
      runtime.readProcessFailureMessage("radon", outcome.stderr, outcome.stdout, outcome.exitCode),
    );
  }

  return {
    args,
    durationMs: outcome.durationMs,
    exitCode: outcome.exitCode,
    files: parsePythonMetricsReport(outcome.stdout),
    finishedAt: outcome.finishedAt,
    startedAt: outcome.startedAt,
  };
}

function parsePythonMetricsReport(report: string): Record<string, PythonMetricsFileMetrics> {
  try {
    return parsers.parsePythonMetrics(report);
  } catch (error) {
    throw new Error(
      `Failed to parse Python metrics output: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function readCoverageMetric(
  summary: Record<string, unknown> | undefined,
  ...keys: string[]
): number | undefined {
  if (summary === undefined) {
    return undefined;
  }

  const value = parsers.readNestedValue(summary, keys);
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
