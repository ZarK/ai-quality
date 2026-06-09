import path from "node:path";

import type { BenchmarkScenario } from "./types.js";

export function createBenchmarkCorpusPart05(root: string): BenchmarkScenario[] {
  const fixture = (relativePath: string): string => path.resolve(root, relativePath);

  return [
    {
      budget: {
        maxDurationMs: 20_000,
        maxStageDurationMs: { lint: 20_000 },
      },
      description: "Cold full-repo lint benchmark for the Rust fixture.",
      fixturePath: fixture("test-projects/rust"),
      id: "rust-lint-full-repo-cold",
      inputs: ["."],
      kind: "cold",
      metadata: {
        languages: ["rust"],
        scale: "medium",
        shape: "full-repo",
        tags: ["cold", "full-repo", "lint", "medium", "rust"],
      },
      profile: "standard",
      stages: ["lint"],
    },
    {
      budget: {
        maxDurationMs: 20_000,
        maxStageDurationMs: { lint: 20_000 },
      },
      description: "Cold single-file lint benchmark for the Rust fixture.",
      fixturePath: fixture("test-projects/rust"),
      id: "rust-lint-single-file-cold",
      inputs: ["src/lib.rs"],
      kind: "cold",
      metadata: {
        languages: ["rust"],
        scale: "medium",
        shape: "single-file",
        tags: ["cold", "lint", "medium", "rust", "single-file"],
      },
      profile: "fast",
      stages: ["lint"],
    },
    {
      budget: {
        maxDurationMs: 20_000,
        maxStageDurationMs: { format: 20_000 },
      },
      description: "Diff-only single-file format benchmark for the Rust fixture.",
      fixturePath: fixture("test-projects/rust"),
      id: "rust-format-single-file-diff",
      inputs: ["src/main.rs"],
      kind: "diff-only",
      metadata: {
        languages: ["rust"],
        scale: "medium",
        shape: "single-file",
        tags: ["diff-only", "format", "medium", "rust", "single-file"],
      },
      profile: "fast",
      stages: ["format"],
    },
    {
      budget: {
        maxDurationMs: 45_000,
        maxStageDurationMs: { typecheck: 45_000 },
      },
      description: "Warm multi-file typecheck benchmark for the Rust fixture.",
      fixturePath: fixture("test-projects/rust"),
      id: "rust-typecheck-multi-file-warm",
      inputs: ["src/lib.rs", "tests/integration.rs"],
      kind: "warm",
      metadata: {
        languages: ["rust"],
        scale: "medium",
        shape: "multi-file",
        tags: ["medium", "multi-file", "rust", "typecheck", "warm"],
      },
      profile: "standard",
      stages: ["typecheck"],
      warmupRuns: 1,
    },
    {
      budget: {
        maxDurationMs: 45_000,
        maxStageDurationMs: { unit: 45_000 },
      },
      description: "Warm sub-folder unit benchmark for the Rust fixture.",
      fixturePath: fixture("test-projects/rust"),
      id: "rust-unit-sub-folder-warm",
      inputs: ["tests"],
      kind: "warm",
      metadata: {
        languages: ["rust"],
        scale: "medium",
        shape: "sub-folder",
        tags: ["medium", "rust", "sub-folder", "unit", "warm"],
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
      description: "Cold full-repo lint benchmark for the Go fixture.",
      fixturePath: fixture("test-projects/go"),
      id: "go-lint-full-repo-cold",
      inputs: ["."],
      kind: "cold",
      metadata: {
        languages: ["go"],
        scale: "medium",
        shape: "full-repo",
        tags: ["ci", "cold", "full-repo", "go", "lint", "medium"],
      },
      profile: "standard",
      stages: ["lint"],
    },
    {
      budget: {
        maxDurationMs: 20_000,
        maxStageDurationMs: { lint: 20_000 },
      },
      description: "Cold single-file lint benchmark for the Go fixture.",
      fixturePath: fixture("test-projects/go"),
      id: "go-lint-single-file-cold",
      inputs: ["greeter.go"],
      kind: "cold",
      metadata: {
        languages: ["go"],
        scale: "medium",
        shape: "single-file",
        tags: ["cold", "go", "lint", "medium", "single-file"],
      },
      profile: "fast",
      stages: ["lint"],
    },
    {
      budget: {
        maxDurationMs: 20_000,
        maxStageDurationMs: { format: 20_000 },
      },
      description: "Diff-only single-file format benchmark for the Go fixture.",
      fixturePath: fixture("test-projects/go"),
      id: "go-format-single-file-diff",
      inputs: ["greeter.go"],
      kind: "diff-only",
      metadata: {
        languages: ["go"],
        scale: "medium",
        shape: "single-file",
        tags: ["diff-only", "format", "go", "medium", "single-file"],
      },
      profile: "fast",
      stages: ["format"],
    },
    {
      budget: {
        maxDurationMs: 30_000,
        maxStageDurationMs: { unit: 30_000 },
      },
      description: "Warm multi-file unit benchmark for the Go fixture.",
      fixturePath: fixture("test-projects/go"),
      id: "go-unit-multi-file-warm",
      inputs: ["greeter.go", "greeter_test.go"],
      kind: "warm",
      metadata: {
        languages: ["go"],
        scale: "medium",
        shape: "multi-file",
        tags: ["go", "medium", "multi-file", "unit", "warm"],
      },
      profile: "standard",
      stages: ["unit"],
      warmupRuns: 1,
    },
    {
      budget: {
        maxDurationMs: 45_000,
        maxStageDurationMs: { coverage: 45_000 },
      },
      description: "Warm sub-folder coverage benchmark for the Go fixture.",
      fixturePath: fixture("test-projects/go"),
      id: "go-coverage-sub-folder-warm",
      inputs: ["pkg"],
      kind: "warm",
      metadata: {
        languages: ["go"],
        scale: "medium",
        shape: "sub-folder",
        tags: ["coverage", "go", "medium", "sub-folder", "warm"],
      },
      profile: "standard",
      stages: ["coverage"],
      warmupRuns: 1,
    },
  ];
}
