import path from "node:path";

import type { BenchmarkScenario } from "./types.js";

export function createBenchmarkCorpusPart07(root: string): BenchmarkScenario[] {
  return [
    ...createBenchmarkCorpusPart07Chunk01(root),
    ...createBenchmarkCorpusPart07Chunk02(root),
    ...createBenchmarkCorpusPart07Chunk03(root),
  ];
}

function createBenchmarkCorpusPart07Chunk01(root: string): BenchmarkScenario[] {
  const fixture = (relativePath: string): string => path.resolve(root, relativePath);

  return [
    {
      budget: {
        maxDurationMs: 20_000,
        maxStageDurationMs: { lint: 20_000 },
      },
      description: "Cold full-repo lint benchmark for the Kotlin fixture.",
      fixturePath: fixture("test-projects/kotlin-gradle"),
      id: "kotlin-lint-full-repo-cold",
      inputs: ["."],
      kind: "cold",
      metadata: {
        languages: ["kotlin"],
        scale: "medium",
        shape: "full-repo",
        tags: ["cold", "full-repo", "kotlin", "lint", "medium"],
      },
      profile: "standard",
      stages: ["lint"],
    },
    {
      budget: {
        maxDurationMs: 20_000,
        maxStageDurationMs: { lint: 20_000 },
      },
      description: "Cold single-file lint benchmark for the Kotlin fixture.",
      fixturePath: fixture("test-projects/kotlin-gradle"),
      id: "kotlin-lint-single-file-cold",
      inputs: ["src/main/kotlin/dev/aiq/fixture/Greeting.kt"],
      kind: "cold",
      metadata: {
        languages: ["kotlin"],
        scale: "medium",
        shape: "single-file",
        tags: ["cold", "kotlin", "lint", "medium", "single-file"],
      },
      profile: "fast",
      stages: ["lint"],
    },
    {
      budget: {
        maxDurationMs: 60_000,
        maxStageDurationMs: { unit: 60_000 },
      },
      description: "Warm multi-file unit benchmark for the Kotlin fixture.",
      fixturePath: fixture("test-projects/kotlin-gradle"),
      id: "kotlin-unit-multi-file-warm",
      inputs: [
        "src/main/kotlin/dev/aiq/fixture/Greeting.kt",
        "src/test/kotlin/dev/aiq/fixture/GreetingTest.kt",
      ],
      kind: "warm",
      metadata: {
        languages: ["kotlin"],
        scale: "medium",
        shape: "multi-file",
        tags: ["kotlin", "medium", "multi-file", "unit", "warm"],
      },
      profile: "standard",
      stages: ["unit"],
      warmupRuns: 1,
    },
    {
      budget: {
        maxDurationMs: 60_000,
        maxStageDurationMs: { security: 60_000 },
      },
      description: "Cold full-repo security benchmark for the Go fixture.",
      fixturePath: fixture("test-projects/go"),
      id: "go-security-full-repo-cold",
      inputs: ["."],
      kind: "cold",
      metadata: {
        languages: ["go"],
        scale: "medium",
        shape: "full-repo",
        tags: ["cold", "full-repo", "go", "medium", "security"],
      },
      profile: "standard",
      stages: ["security"],
    },
  ];
}

function createBenchmarkCorpusPart07Chunk02(root: string): BenchmarkScenario[] {
  const fixture = (relativePath: string): string => path.resolve(root, relativePath);

  return [
    {
      budget: {
        maxDurationMs: 60_000,
        maxStageDurationMs: { security: 60_000 },
      },
      description: "Warm full-repo security benchmark for the Go fixture.",
      fixturePath: fixture("test-projects/go"),
      id: "go-security-full-repo-warm",
      inputs: ["."],
      kind: "warm",
      metadata: {
        languages: ["go"],
        scale: "medium",
        shape: "full-repo",
        tags: ["full-repo", "go", "medium", "security", "warm"],
      },
      profile: "standard",
      stages: ["security"],
      warmupRuns: 1,
    },
    {
      budget: {
        maxDurationMs: 60_000,
        maxStageDurationMs: { security: 60_000 },
      },
      description: "Cold full-repo security benchmark for the Rust fixture.",
      fixturePath: fixture("test-projects/rust"),
      id: "rust-security-full-repo-cold",
      inputs: ["."],
      kind: "cold",
      metadata: {
        languages: ["rust"],
        scale: "medium",
        shape: "full-repo",
        tags: ["cold", "full-repo", "medium", "rust", "security"],
      },
      profile: "standard",
      stages: ["security"],
    },
    {
      budget: {
        maxDurationMs: 60_000,
        maxStageDurationMs: { security: 60_000 },
      },
      description: "Warm full-repo security benchmark for the Rust fixture.",
      fixturePath: fixture("test-projects/rust"),
      id: "rust-security-full-repo-warm",
      inputs: ["."],
      kind: "warm",
      metadata: {
        languages: ["rust"],
        scale: "medium",
        shape: "full-repo",
        tags: ["full-repo", "medium", "rust", "security", "warm"],
      },
      profile: "standard",
      stages: ["security"],
      warmupRuns: 1,
    },
    {
      budget: {
        maxDurationMs: 60_000,
        maxStageDurationMs: { security: 60_000 },
      },
      description: "Cold full-repo security benchmark for the Java fixture.",
      fixturePath: fixture("test-projects/java-maven"),
      id: "java-security-full-repo-cold",
      inputs: ["."],
      kind: "cold",
      metadata: {
        languages: ["java"],
        scale: "medium",
        shape: "full-repo",
        tags: ["cold", "full-repo", "java", "medium", "security"],
      },
      profile: "standard",
      stages: ["security"],
    },
  ];
}

function createBenchmarkCorpusPart07Chunk03(root: string): BenchmarkScenario[] {
  const fixture = (relativePath: string): string => path.resolve(root, relativePath);

  return [
    {
      budget: {
        maxDurationMs: 60_000,
        maxStageDurationMs: { security: 60_000 },
      },
      description: "Warm full-repo security benchmark for the Java fixture.",
      fixturePath: fixture("test-projects/java-maven"),
      id: "java-security-full-repo-warm",
      inputs: ["."],
      kind: "warm",
      metadata: {
        languages: ["java"],
        scale: "medium",
        shape: "full-repo",
        tags: ["full-repo", "java", "medium", "security", "warm"],
      },
      profile: "standard",
      stages: ["security"],
      warmupRuns: 1,
    },
    {
      budget: {
        maxDurationMs: 60_000,
        maxStageDurationMs: { security: 60_000 },
      },
      description: "Cold full-repo security benchmark for the Kotlin fixture.",
      fixturePath: fixture("test-projects/kotlin-gradle"),
      id: "kotlin-security-full-repo-cold",
      inputs: ["."],
      kind: "cold",
      metadata: {
        languages: ["kotlin"],
        scale: "medium",
        shape: "full-repo",
        tags: ["cold", "full-repo", "kotlin", "medium", "security"],
      },
      profile: "standard",
      stages: ["security"],
    },
  ];
}
