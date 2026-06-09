import path from "node:path";

import type { BenchmarkScenario } from "./types.js";

export function createBenchmarkCorpusPart02(root: string): BenchmarkScenario[] {
  return [
    ...createBenchmarkCorpusPart02Chunk01(root),
    ...createBenchmarkCorpusPart02Chunk02(root),
    ...createBenchmarkCorpusPart02Chunk03(root),
  ];
}

function createBenchmarkCorpusPart02Chunk01(root: string): BenchmarkScenario[] {
  const fixture = (relativePath: string): string => path.resolve(root, relativePath);

  return [
    {
      budget: {
        maxDurationMs: 30_000,
        maxStageDurationMs: { coverage: 30_000 },
      },
      description: "Warm full-repo coverage benchmark for the JavaScript fixture.",
      fixturePath: fixture("test-projects/javascript"),
      id: "javascript-coverage-full-repo-warm",
      inputs: ["."],
      kind: "warm",
      metadata: {
        languages: ["javascript"],
        scale: "small",
        shape: "full-repo",
        tags: ["coverage", "full-repo", "javascript", "small", "warm"],
      },
      profile: "standard",
      stages: ["coverage"],
      warmupRuns: 1,
    },
    {
      budget: {
        maxDurationMs: 30_000,
        maxStageDurationMs: { coverage: 30_000 },
      },
      description: "Warm sub-folder coverage benchmark for the JavaScript fixture.",
      fixturePath: fixture("test-projects/javascript"),
      id: "javascript-coverage-sub-folder-warm",
      inputs: ["src"],
      kind: "warm",
      metadata: {
        languages: ["javascript"],
        scale: "small",
        shape: "sub-folder",
        tags: ["coverage", "javascript", "small", "sub-folder", "warm"],
      },
      profile: "standard",
      stages: ["coverage"],
      warmupRuns: 1,
    },
    {
      budget: {
        maxDurationMs: 30_000,
        maxStageDurationMs: { typecheck: 30_000 },
      },
      description: "Warm sub-folder typecheck benchmark for the TypeScript fixture.",
      fixturePath: fixture("test-projects/typescript"),
      id: "typescript-typecheck-sub-folder-warm",
      inputs: ["src"],
      kind: "warm",
      metadata: {
        languages: ["typescript"],
        scale: "small",
        shape: "sub-folder",
        tags: ["sub-folder", "typecheck", "typescript", "warm"],
      },
      profile: "standard",
      stages: ["typecheck"],
      warmupRuns: 1,
    },
    {
      budget: {
        maxDurationMs: 30_000,
        maxStageDurationMs: { typecheck: 30_000 },
      },
      description: "Cold single-file typecheck benchmark for the TypeScript fixture.",
      fixturePath: fixture("test-projects/typescript"),
      id: "typescript-typecheck-single-file-cold",
      inputs: ["src/index.ts"],
      kind: "cold",
      metadata: {
        languages: ["typescript"],
        scale: "small",
        shape: "single-file",
        tags: ["cold", "single-file", "typecheck", "typescript"],
      },
      profile: "standard",
      stages: ["typecheck"],
    },
  ];
}

function createBenchmarkCorpusPart02Chunk02(root: string): BenchmarkScenario[] {
  const fixture = (relativePath: string): string => path.resolve(root, relativePath);

  return [
    {
      budget: {
        maxDurationMs: 45_000,
        maxStageDurationMs: {
          complexity: 45_000,
          maintainability: 45_000,
          sloc: 45_000,
        },
      },
      description: "Warm multi-file shared metrics benchmark for the larger TypeScript fixture.",
      fixturePath: fixture("test-projects/benchmark-typescript-large"),
      id: "typescript-metrics-multi-file-warm",
      inputs: ["src/index.ts", "src/workflow.ts", "src/workflow.test.ts", "src/index.test.ts"],
      kind: "warm",
      metadata: {
        languages: ["typescript"],
        scale: "large",
        shape: "multi-file",
        tags: ["ci", "large", "metrics", "multi-file", "typescript", "warm"],
      },
      profile: "standard",
      stages: ["sloc", "complexity", "maintainability"],
      warmupRuns: 1,
    },
    {
      budget: {
        maxDurationMs: 60_000,
        maxStageDurationMs: {
          coverage: 60_000,
          unit: 60_000,
        },
      },
      description: "Warm full-repo unit and coverage benchmark for the TypeScript fixture.",
      fixturePath: fixture("test-projects/typescript"),
      id: "typescript-unit-coverage-full-repo-warm",
      inputs: ["src", "vitest.config.ts"],
      kind: "warm",
      metadata: {
        languages: ["typescript"],
        scale: "medium",
        shape: "full-repo",
        tags: ["ci", "coverage", "full-repo", "medium", "typescript", "unit", "warm"],
      },
      profile: "standard",
      stages: ["unit", "coverage"],
      warmupRuns: 1,
    },
    {
      budget: {
        maxDurationMs: 30_000,
        maxStageDurationMs: { unit: 30_000 },
      },
      description: "Warm sub-folder unit benchmark for the TypeScript fixture.",
      fixturePath: fixture("test-projects/typescript"),
      id: "typescript-unit-sub-folder-warm",
      inputs: ["src"],
      kind: "warm",
      metadata: {
        languages: ["typescript"],
        scale: "small",
        shape: "sub-folder",
        tags: ["sub-folder", "typescript", "unit", "warm"],
      },
      profile: "standard",
      stages: ["unit"],
      warmupRuns: 1,
    },
    {
      budget: {
        maxDurationMs: 20_000,
        maxStageDurationMs: { lint: 20_000 },
      },
      description: "Cold single-file lint benchmark for the TypeScript fixture.",
      fixturePath: fixture("test-projects/typescript"),
      id: "typescript-lint-single-file-cold",
      inputs: ["src/index.ts"],
      kind: "cold",
      metadata: {
        languages: ["typescript"],
        scale: "small",
        shape: "single-file",
        tags: ["cold", "lint", "single-file", "small", "typescript"],
      },
      profile: "fast",
      stages: ["lint"],
    },
  ];
}

function createBenchmarkCorpusPart02Chunk03(root: string): BenchmarkScenario[] {
  const fixture = (relativePath: string): string => path.resolve(root, relativePath);

  return [
    {
      budget: {
        maxDurationMs: 20_000,
        maxStageDurationMs: { lint: 20_000 },
      },
      description: "Diff-only multi-file lint benchmark for the TypeScript fixture.",
      fixturePath: fixture("test-projects/typescript"),
      id: "typescript-lint-multi-file-diff",
      inputs: ["src/index.ts", "src/index.test.ts"],
      kind: "diff-only",
      metadata: {
        languages: ["typescript"],
        scale: "small",
        shape: "multi-file",
        tags: ["diff-only", "lint", "multi-file", "small", "typescript"],
      },
      profile: "fast",
      stages: ["lint"],
    },
    {
      budget: {
        maxDurationMs: 20_000,
        maxStageDurationMs: { lint: 20_000 },
      },
      description: "Warm full-repo lint benchmark for the TypeScript fixture.",
      fixturePath: fixture("test-projects/typescript"),
      id: "typescript-lint-full-repo-warm",
      inputs: ["."],
      kind: "warm",
      metadata: {
        languages: ["typescript"],
        scale: "small",
        shape: "full-repo",
        tags: ["full-repo", "lint", "small", "typescript", "warm"],
      },
      profile: "standard",
      stages: ["lint"],
      warmupRuns: 1,
    },
  ];
}
