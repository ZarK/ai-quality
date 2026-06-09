import path from "node:path";

import type { BenchmarkScenario } from "./types.js";

export function createBenchmarkCorpusPart03(root: string): BenchmarkScenario[] {
  return [
    ...createBenchmarkCorpusPart03Chunk01(root),
    ...createBenchmarkCorpusPart03Chunk02(root),
    ...createBenchmarkCorpusPart03Chunk03(root),
  ];
}

function createBenchmarkCorpusPart03Chunk01(root: string): BenchmarkScenario[] {
  const fixture = (relativePath: string): string => path.resolve(root, relativePath);

  return [
    {
      budget: {
        maxDurationMs: 20_000,
        maxStageDurationMs: { lint: 20_000 },
      },
      description: "Cold single-file lint benchmark for the Python fixture.",
      fixturePath: fixture("test-projects/python"),
      id: "python-lint-single-file-cold",
      inputs: ["main.py"],
      kind: "cold",
      metadata: {
        languages: ["python"],
        scale: "medium",
        shape: "single-file",
        tags: ["cold", "lint", "medium", "python", "single-file"],
      },
      profile: "fast",
      stages: ["lint"],
    },
    {
      budget: {
        maxDurationMs: 20_000,
        maxStageDurationMs: { format: 20_000 },
      },
      description: "Cold single-file format benchmark for the TypeScript fixture.",
      fixturePath: fixture("test-projects/typescript"),
      id: "typescript-format-single-file-cold",
      inputs: ["src/index.ts"],
      kind: "cold",
      metadata: {
        languages: ["typescript"],
        scale: "small",
        shape: "single-file",
        tags: ["cold", "format", "single-file", "small", "typescript"],
      },
      profile: "fast",
      stages: ["format"],
    },
    {
      budget: {
        maxDurationMs: 20_000,
        maxStageDurationMs: { format: 20_000 },
      },
      description: "Warm sub-folder format benchmark for the TypeScript fixture.",
      fixturePath: fixture("test-projects/typescript"),
      id: "typescript-format-sub-folder-warm",
      inputs: ["src"],
      kind: "warm",
      metadata: {
        languages: ["typescript"],
        scale: "small",
        shape: "sub-folder",
        tags: ["format", "sub-folder", "small", "typescript", "warm"],
      },
      profile: "standard",
      stages: ["format"],
      warmupRuns: 1,
    },
    {
      budget: {
        maxDurationMs: 20_000,
        maxStageDurationMs: { format: 20_000 },
      },
      description: "Warm full-repo format benchmark for the TypeScript fixture.",
      fixturePath: fixture("test-projects/typescript"),
      id: "typescript-format-full-repo-warm",
      inputs: ["."],
      kind: "warm",
      metadata: {
        languages: ["typescript"],
        scale: "small",
        shape: "full-repo",
        tags: ["format", "full-repo", "small", "typescript", "warm"],
      },
      profile: "standard",
      stages: ["format"],
      warmupRuns: 1,
    },
  ];
}

function createBenchmarkCorpusPart03Chunk02(root: string): BenchmarkScenario[] {
  const fixture = (relativePath: string): string => path.resolve(root, relativePath);

  return [
    {
      budget: {
        maxDurationMs: 45_000,
        maxStageDurationMs: { sloc: 45_000 },
      },
      description: "Warm multi-file sloc benchmark for the TypeScript fixture.",
      fixturePath: fixture("test-projects/typescript"),
      id: "typescript-sloc-multi-file-warm",
      inputs: ["src/index.ts", "src/index.test.ts"],
      kind: "warm",
      metadata: {
        languages: ["typescript"],
        scale: "small",
        shape: "multi-file",
        tags: ["multi-file", "small", "sloc", "typescript", "warm"],
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
      description: "Cold full-repo complexity benchmark for the TypeScript fixture.",
      fixturePath: fixture("test-projects/typescript"),
      id: "typescript-complexity-full-repo-cold",
      inputs: ["."],
      kind: "cold",
      metadata: {
        languages: ["typescript"],
        scale: "small",
        shape: "full-repo",
        tags: ["cold", "complexity", "full-repo", "small", "typescript"],
      },
      profile: "standard",
      stages: ["complexity"],
    },
    {
      budget: {
        maxDurationMs: 45_000,
        maxStageDurationMs: { maintainability: 45_000 },
      },
      description: "Warm full-repo maintainability benchmark for the TypeScript fixture.",
      fixturePath: fixture("test-projects/typescript"),
      id: "typescript-maintainability-full-repo-warm",
      inputs: ["."],
      kind: "warm",
      metadata: {
        languages: ["typescript"],
        scale: "small",
        shape: "full-repo",
        tags: ["full-repo", "maintainability", "small", "typescript", "warm"],
      },
      profile: "standard",
      stages: ["maintainability"],
      warmupRuns: 1,
    },
    {
      budget: {
        maxDurationMs: 20_000,
        maxStageDurationMs: { lint: 20_000 },
      },
      description: "Cold full-repo lint benchmark for the TypeScript fixture.",
      fixturePath: fixture("test-projects/typescript"),
      id: "typescript-lint-full-repo-cold",
      inputs: ["."],
      kind: "cold",
      metadata: {
        languages: ["typescript"],
        scale: "small",
        shape: "full-repo",
        tags: ["cold", "full-repo", "lint", "small", "typescript"],
      },
      profile: "standard",
      stages: ["lint"],
    },
  ];
}

function createBenchmarkCorpusPart03Chunk03(root: string): BenchmarkScenario[] {
  const fixture = (relativePath: string): string => path.resolve(root, relativePath);

  return [
    {
      budget: {
        maxDurationMs: 20_000,
        maxStageDurationMs: { format: 20_000 },
      },
      description: "Diff-only full-repo format benchmark for the TypeScript fixture.",
      fixturePath: fixture("test-projects/typescript"),
      id: "typescript-format-full-repo-diff",
      inputs: ["."],
      kind: "diff-only",
      metadata: {
        languages: ["typescript"],
        scale: "small",
        shape: "full-repo",
        tags: ["ci", "diff-only", "format", "full-repo", "small", "typescript"],
      },
      profile: "fast",
      stages: ["format"],
    },
    {
      budget: {
        maxDurationMs: 90_000,
        maxStageDurationMs: {
          complexity: 90_000,
          coverage: 90_000,
          format: 90_000,
          lint: 90_000,
          maintainability: 90_000,
          security: 90_000,
          typecheck: 90_000,
          unit: 90_000,
        },
      },
      description: "Cold full-repo Python quality benchmark across runnable stages.",
      fixturePath: fixture("test-projects/python"),
      id: "python-quality-full-repo-cold",
      inputs: ["main.py", "tests/test_main.py", "tests"],
      kind: "cold",
      metadata: {
        languages: ["python"],
        scale: "medium",
        shape: "full-repo",
        tags: ["ci", "cold", "full-repo", "medium", "python", "quality", "security"],
      },
      profile: "standard",
      stages: [
        "lint",
        "format",
        "typecheck",
        "unit",
        "coverage",
        "complexity",
        "maintainability",
        "security",
      ],
    },
  ];
}
