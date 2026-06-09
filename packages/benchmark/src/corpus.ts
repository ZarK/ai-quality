import { createBenchmarkCorpusPart01 } from "./corpus-part-01.js";
import { createBenchmarkCorpusPart02 } from "./corpus-part-02.js";
import { createBenchmarkCorpusPart03 } from "./corpus-part-03.js";
import { createBenchmarkCorpusPart04 } from "./corpus-part-04.js";
import { createBenchmarkCorpusPart05 } from "./corpus-part-05.js";
import { createBenchmarkCorpusPart06 } from "./corpus-part-06.js";
import { createBenchmarkCorpusPart07 } from "./corpus-part-07.js";
import { createBenchmarkCorpusPart08 } from "./corpus-part-08.js";
import { createBenchmarkCorpusPart09 } from "./corpus-part-09.js";
import { createBenchmarkCorpusPart10 } from "./corpus-part-10.js";

import type { BenchmarkScenario } from "./types.js";

const corpusParts = [
  createBenchmarkCorpusPart01,
  createBenchmarkCorpusPart02,
  createBenchmarkCorpusPart03,
  createBenchmarkCorpusPart04,
  createBenchmarkCorpusPart05,
  createBenchmarkCorpusPart06,
  createBenchmarkCorpusPart07,
  createBenchmarkCorpusPart08,
  createBenchmarkCorpusPart09,
  createBenchmarkCorpusPart10,
];

export function createDefaultBenchmarkCorpus(root = process.cwd()): BenchmarkScenario[] {
  return corpusParts.flatMap((createPart) => createPart(root));
}
