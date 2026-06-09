import path from "node:path";

import type { BenchmarkScenario } from "./types.js";

export function createBenchmarkCorpusPart01(root: string): BenchmarkScenario[] {
  const fixture = (relativePath: string): string => path.resolve(root, relativePath);

  return [
    {
      budget: {
        maxDurationMs: 20_000,
        maxStageDurationMs: { lint: 20_000 },
      },
      description: "Cold single-file lint benchmark for the JavaScript fixture.",
      fixturePath: fixture("test-projects/javascript"),
      id: "javascript-lint-single-file-cold",
      inputs: ["index.js"],
      kind: "cold",
      metadata: {
        languages: ["javascript"],
        scale: "small",
        shape: "single-file",
        tags: ["ci", "cold", "javascript", "lint", "single-file", "small"],
      },
      profile: "fast",
      stages: ["lint"],
    },
    {
      budget: {
        maxDurationMs: 20_000,
        maxStageDurationMs: { format: 20_000 },
      },
      description: "Diff-only single-file format benchmark for the JavaScript fixture.",
      fixturePath: fixture("test-projects/javascript"),
      id: "javascript-format-single-file-diff",
      inputs: ["index.js"],
      kind: "diff-only",
      metadata: {
        languages: ["javascript"],
        scale: "small",
        shape: "single-file",
        tags: ["diff-only", "format", "javascript", "single-file", "small"],
      },
      profile: "fast",
      stages: ["format"],
    },
    {
      budget: {
        maxDurationMs: 30_000,
        maxStageDurationMs: { unit: 30_000 },
      },
      description: "Cold single-file unit benchmark for the JavaScript fixture.",
      fixturePath: fixture("test-projects/javascript"),
      id: "javascript-unit-single-file-cold",
      inputs: ["index.test.js"],
      kind: "cold",
      metadata: {
        languages: ["javascript"],
        scale: "small",
        shape: "single-file",
        tags: ["cold", "javascript", "single-file", "small", "unit"],
      },
      profile: "fast",
      stages: ["unit"],
    },
    {
      budget: {
        maxDurationMs: 30_000,
        maxStageDurationMs: { unit: 30_000 },
      },
      description: "Warm single-file unit benchmark for the JavaScript fixture.",
      fixturePath: fixture("test-projects/javascript"),
      id: "javascript-unit-single-file-warm",
      inputs: ["index.test.js"],
      kind: "warm",
      metadata: {
        languages: ["javascript"],
        scale: "small",
        shape: "single-file",
        tags: ["javascript", "single-file", "small", "unit", "warm"],
      },
      profile: "standard",
      stages: ["unit"],
      warmupRuns: 1,
    },
    {
      budget: {
        maxDurationMs: 30_000,
        maxStageDurationMs: { unit: 30_000 },
      },
      description: "Warm full-repo unit benchmark for the JavaScript fixture.",
      fixturePath: fixture("test-projects/javascript"),
      id: "javascript-unit-full-repo-warm",
      inputs: ["."],
      kind: "warm",
      metadata: {
        languages: ["javascript"],
        scale: "small",
        shape: "full-repo",
        tags: ["full-repo", "javascript", "small", "unit", "warm"],
      },
      profile: "standard",
      stages: ["unit"],
      warmupRuns: 1,
    },
    {
      budget: {
        maxDurationMs: 30_000,
        maxStageDurationMs: { unit: 30_000 },
      },
      description: "Cold full-repo unit benchmark for the JavaScript fixture.",
      fixturePath: fixture("test-projects/javascript"),
      id: "javascript-unit-full-repo-cold",
      inputs: ["."],
      kind: "cold",
      metadata: {
        languages: ["javascript"],
        scale: "small",
        shape: "full-repo",
        tags: ["cold", "full-repo", "javascript", "small", "unit"],
      },
      profile: "standard",
      stages: ["unit"],
    },
    {
      budget: {
        maxDurationMs: 45_000,
        maxStageDurationMs: { sloc: 45_000 },
      },
      description: "Diff-only single-file sloc benchmark for the JavaScript fixture.",
      fixturePath: fixture("test-projects/javascript"),
      id: "javascript-sloc-single-file-diff",
      inputs: ["index.js"],
      kind: "diff-only",
      metadata: {
        languages: ["javascript"],
        scale: "small",
        shape: "single-file",
        tags: ["diff-only", "javascript", "single-file", "small", "sloc"],
      },
      profile: "fast",
      stages: ["sloc"],
    },
    {
      budget: {
        maxDurationMs: 45_000,
        maxStageDurationMs: { sloc: 45_000 },
      },
      description: "Warm multi-file sloc benchmark for the JavaScript fixture.",
      fixturePath: fixture("test-projects/javascript"),
      id: "javascript-sloc-multi-file-warm",
      inputs: ["index.js", "index.test.js"],
      kind: "warm",
      metadata: {
        languages: ["javascript"],
        scale: "small",
        shape: "multi-file",
        tags: ["javascript", "multi-file", "small", "sloc", "warm"],
      },
      profile: "standard",
      stages: ["sloc"],
      warmupRuns: 1,
    },
    {
      budget: {
        maxDurationMs: 45_000,
        maxStageDurationMs: { complexity: 45_000 },
      },
      description: "Warm multi-file complexity benchmark for the JavaScript fixture.",
      fixturePath: fixture("test-projects/javascript"),
      id: "javascript-complexity-multi-file-warm",
      inputs: ["index.js", "index.test.js"],
      kind: "warm",
      metadata: {
        languages: ["javascript"],
        scale: "small",
        shape: "multi-file",
        tags: ["complexity", "javascript", "multi-file", "small", "warm"],
      },
      profile: "standard",
      stages: ["complexity"],
      warmupRuns: 1,
    },
    {
      budget: {
        maxDurationMs: 45_000,
        maxStageDurationMs: { maintainability: 45_000 },
      },
      description: "Cold full-repo maintainability benchmark for the JavaScript fixture.",
      fixturePath: fixture("test-projects/javascript"),
      id: "javascript-maintainability-full-repo-cold",
      inputs: ["."],
      kind: "cold",
      metadata: {
        languages: ["javascript"],
        scale: "small",
        shape: "full-repo",
        tags: ["cold", "full-repo", "javascript", "maintainability", "small"],
      },
      profile: "standard",
      stages: ["maintainability"],
    },
  ];
}
