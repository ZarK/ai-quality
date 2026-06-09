import path from "node:path";

import type { BenchmarkScenario } from "./types.js";

export function createBenchmarkCorpusPart04(root: string): BenchmarkScenario[] {
  return [
    ...createBenchmarkCorpusPart04Chunk01(root),
    ...createBenchmarkCorpusPart04Chunk02(root),
    ...createBenchmarkCorpusPart04Chunk03(root),
  ];
}

function createBenchmarkCorpusPart04Chunk01(root: string): BenchmarkScenario[] {
  const fixture = (relativePath: string): string => path.resolve(root, relativePath);

  return [
    {
      budget: {
        maxDurationMs: 20_000,
        maxStageDurationMs: { lint: 20_000 },
      },
      description: "Warm full-repo lint benchmark for the Python fixture.",
      fixturePath: fixture("test-projects/python"),
      id: "python-lint-full-repo-warm",
      inputs: ["."],
      kind: "warm",
      metadata: {
        languages: ["python"],
        scale: "medium",
        shape: "full-repo",
        tags: ["ci", "full-repo", "lint", "medium", "python", "warm"],
      },
      profile: "standard",
      stages: ["lint"],
      warmupRuns: 1,
    },
    {
      budget: {
        maxDurationMs: 20_000,
        maxStageDurationMs: { format: 20_000 },
      },
      description: "Diff-only single-file format benchmark for the Python fixture.",
      fixturePath: fixture("test-projects/python"),
      id: "python-format-single-file-diff",
      inputs: ["main.py"],
      kind: "diff-only",
      metadata: {
        languages: ["python"],
        scale: "medium",
        shape: "single-file",
        tags: ["diff-only", "format", "medium", "python", "single-file"],
      },
      profile: "fast",
      stages: ["format"],
    },
    {
      budget: {
        maxDurationMs: 30_000,
        maxStageDurationMs: { typecheck: 30_000 },
      },
      description: "Warm full-repo typecheck benchmark for the Python fixture.",
      fixturePath: fixture("test-projects/python"),
      id: "python-typecheck-full-repo-warm",
      inputs: ["."],
      kind: "warm",
      metadata: {
        languages: ["python"],
        scale: "medium",
        shape: "full-repo",
        tags: ["full-repo", "medium", "python", "typecheck", "warm"],
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
      description: "Warm multi-file typecheck benchmark for the Python fixture.",
      fixturePath: fixture("test-projects/python"),
      id: "python-typecheck-multi-file-warm",
      inputs: ["main.py", "tests/test_main.py"],
      kind: "warm",
      metadata: {
        languages: ["python"],
        scale: "medium",
        shape: "multi-file",
        tags: ["medium", "multi-file", "python", "typecheck", "warm"],
      },
      profile: "standard",
      stages: ["typecheck"],
      warmupRuns: 1,
    },
  ];
}

function createBenchmarkCorpusPart04Chunk02(root: string): BenchmarkScenario[] {
  const fixture = (relativePath: string): string => path.resolve(root, relativePath);

  return [
    {
      budget: {
        maxDurationMs: 30_000,
        maxStageDurationMs: { unit: 30_000 },
      },
      description: "Warm sub-folder unit benchmark for the Python fixture.",
      fixturePath: fixture("test-projects/python"),
      id: "python-unit-sub-folder-warm",
      inputs: ["tests"],
      kind: "warm",
      metadata: {
        languages: ["python"],
        scale: "medium",
        shape: "sub-folder",
        tags: ["medium", "python", "sub-folder", "unit", "warm"],
      },
      profile: "standard",
      stages: ["unit"],
      warmupRuns: 1,
    },
    {
      budget: {
        maxDurationMs: 45_000,
        maxStageDurationMs: {
          format: 45_000,
          lint: 45_000,
          security: 45_000,
          typecheck: 45_000,
        },
      },
      description: "Cold full-repo Terraform and HCL benchmark for infrastructure stages.",
      fixturePath: fixture("test-projects/benchmark-terraform-hcl"),
      id: "terraform-hcl-infra-full-repo-cold",
      inputs: ["."],
      kind: "cold",
      metadata: {
        languages: ["terraform", "hcl"],
        scale: "small",
        shape: "full-repo",
        tags: ["cold", "full-repo", "hcl", "infrastructure", "security", "small", "terraform"],
      },
      profile: "standard",
      stages: ["lint", "format", "typecheck", "security"],
    },
    {
      budget: {
        maxDurationMs: 20_000,
        maxStageDurationMs: { lint: 20_000 },
      },
      description: "Warm full-repo lint benchmark for the Terraform fixture.",
      fixturePath: fixture("test-projects/benchmark-terraform-hcl"),
      id: "terraform-lint-full-repo-warm",
      inputs: ["."],
      kind: "warm",
      metadata: {
        languages: ["terraform", "hcl"],
        scale: "small",
        shape: "full-repo",
        tags: ["full-repo", "hcl", "lint", "small", "terraform", "warm"],
      },
      profile: "standard",
      stages: ["lint"],
      warmupRuns: 1,
    },
    {
      budget: {
        maxDurationMs: 20_000,
        maxStageDurationMs: { format: 20_000 },
      },
      description: "Diff-only single-file format benchmark for the Terraform fixture.",
      fixturePath: fixture("test-projects/benchmark-terraform-hcl"),
      id: "terraform-format-single-file-diff",
      inputs: ["main.tf"],
      kind: "diff-only",
      metadata: {
        languages: ["terraform", "hcl"],
        scale: "small",
        shape: "single-file",
        tags: ["diff-only", "format", "hcl", "single-file", "small", "terraform"],
      },
      profile: "fast",
      stages: ["format"],
    },
  ];
}

function createBenchmarkCorpusPart04Chunk03(root: string): BenchmarkScenario[] {
  const fixture = (relativePath: string): string => path.resolve(root, relativePath);

  return [
    {
      budget: {
        maxDurationMs: 90_000,
        maxStageDurationMs: {
          complexity: 90_000,
          coverage: 90_000,
          format: 90_000,
          lint: 90_000,
          maintainability: 90_000,
          sloc: 90_000,
          typecheck: 90_000,
          unit: 90_000,
        },
      },
      description: "Warm full-repo Go benchmark across build, test, and metrics stages.",
      fixturePath: fixture("test-projects/go"),
      id: "go-quality-full-repo-warm",
      inputs: ["."],
      kind: "warm",
      metadata: {
        languages: ["go"],
        scale: "medium",
        shape: "full-repo",
        tags: ["full-repo", "go", "medium", "quality", "warm"],
      },
      profile: "standard",
      stages: [
        "lint",
        "format",
        "typecheck",
        "unit",
        "coverage",
        "sloc",
        "complexity",
        "maintainability",
      ],
      warmupRuns: 1,
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
          sloc: 90_000,
          typecheck: 90_000,
          unit: 90_000,
        },
      },
      description: "Warm full-repo Rust benchmark across build, test, and metrics stages.",
      fixturePath: fixture("test-projects/rust"),
      id: "rust-quality-full-repo-warm",
      inputs: ["."],
      kind: "warm",
      metadata: {
        languages: ["rust"],
        scale: "medium",
        shape: "full-repo",
        tags: ["full-repo", "medium", "quality", "rust", "warm"],
      },
      profile: "standard",
      stages: [
        "lint",
        "format",
        "typecheck",
        "unit",
        "coverage",
        "sloc",
        "complexity",
        "maintainability",
      ],
      warmupRuns: 1,
    },
  ];
}
