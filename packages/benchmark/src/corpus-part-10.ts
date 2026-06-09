import path from "node:path";

import type { BenchmarkScenario } from "./types.js";

export function createBenchmarkCorpusPart10(root: string): BenchmarkScenario[] {
  const fixture = (relativePath: string): string => path.resolve(root, relativePath);

  return [
    {
      budget: {
        maxDurationMs: 20_000,
        maxStageDurationMs: { lint: 20_000 },
      },
      description: "Warm full-repo lint benchmark for the CSS fixture.",
      fixturePath: fixture("test-projects/html-css"),
      id: "css-lint-full-repo-warm",
      inputs: ["."],
      kind: "warm",
      metadata: {
        languages: ["css"],
        scale: "small",
        shape: "full-repo",
        tags: ["css", "full-repo", "lint", "small", "warm"],
      },
      profile: "standard",
      stages: ["lint"],
      warmupRuns: 1,
    },
    {
      budget: {
        maxDurationMs: 20_000,
        maxStageDurationMs: { lint: 20_000 },
      },
      description: "Diff-only single-file lint benchmark for the YAML fixture.",
      fixturePath: fixture("test-projects/yaml"),
      id: "yaml-lint-single-file-diff",
      inputs: ["config.yaml"],
      kind: "diff-only",
      metadata: {
        languages: ["yaml"],
        scale: "small",
        shape: "single-file",
        tags: ["diff-only", "lint", "single-file", "small", "yaml"],
      },
      profile: "fast",
      stages: ["lint"],
    },
    {
      budget: {
        maxDurationMs: 20_000,
        maxStageDurationMs: { lint: 20_000 },
      },
      description: "Warm full-repo lint benchmark for the YAML fixture.",
      fixturePath: fixture("test-projects/yaml"),
      id: "yaml-lint-full-repo-warm",
      inputs: ["."],
      kind: "warm",
      metadata: {
        languages: ["yaml"],
        scale: "small",
        shape: "full-repo",
        tags: ["full-repo", "lint", "small", "warm", "yaml"],
      },
      profile: "standard",
      stages: ["lint"],
      warmupRuns: 1,
    },
    {
      budget: {
        maxDurationMs: 20_000,
        maxStageDurationMs: { lint: 20_000 },
      },
      description: "Cold single-file lint benchmark for the SQL fixture.",
      fixturePath: fixture("test-projects/sql"),
      id: "sql-lint-single-file-cold",
      inputs: ["query.sql"],
      kind: "cold",
      metadata: {
        languages: ["sql"],
        scale: "small",
        shape: "single-file",
        tags: ["cold", "lint", "single-file", "small", "sql"],
      },
      profile: "fast",
      stages: ["lint"],
    },
    {
      budget: {
        maxDurationMs: 20_000,
        maxStageDurationMs: { format: 20_000 },
      },
      description: "Diff-only single-file format benchmark for the SQL fixture.",
      fixturePath: fixture("test-projects/sql"),
      id: "sql-format-single-file-diff",
      inputs: ["query.sql"],
      kind: "diff-only",
      metadata: {
        languages: ["sql"],
        scale: "small",
        shape: "single-file",
        tags: ["diff-only", "format", "single-file", "small", "sql"],
      },
      profile: "fast",
      stages: ["format"],
    },
    {
      budget: {
        maxDurationMs: 20_000,
        maxStageDurationMs: { format: 20_000 },
      },
      description: "Warm full-repo format benchmark for the SQL fixture.",
      fixturePath: fixture("test-projects/sql"),
      id: "sql-format-full-repo-warm",
      inputs: ["."],
      kind: "warm",
      metadata: {
        languages: ["sql"],
        scale: "small",
        shape: "full-repo",
        tags: ["format", "full-repo", "small", "sql", "warm"],
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
      description: "Cold single-file format benchmark for the documents fixture.",
      fixturePath: fixture("test-projects/html-css"),
      id: "documents-format-single-file-cold",
      inputs: ["index.html"],
      kind: "cold",
      metadata: {
        languages: ["documents"],
        scale: "small",
        shape: "single-file",
        tags: ["cold", "documents", "format", "single-file", "small"],
      },
      profile: "fast",
      stages: ["format"],
    },
    {
      budget: {
        maxDurationMs: 20_000,
        maxStageDurationMs: { format: 20_000 },
      },
      description: "Warm full-repo format benchmark for the documents fixture.",
      fixturePath: fixture("test-projects/html-css"),
      id: "documents-format-full-repo-warm",
      inputs: ["."],
      kind: "warm",
      metadata: {
        languages: ["documents"],
        scale: "small",
        shape: "full-repo",
        tags: ["documents", "format", "full-repo", "small", "warm"],
      },
      profile: "standard",
      stages: ["format"],
      warmupRuns: 1,
    },
  ];
}
