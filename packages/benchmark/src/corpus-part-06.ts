import path from "node:path";

import type { BenchmarkScenario } from "./types.js";

export function createBenchmarkCorpusPart06(root: string): BenchmarkScenario[] {
  return [
    ...createBenchmarkCorpusPart06Chunk01(root),
    ...createBenchmarkCorpusPart06Chunk02(root),
    ...createBenchmarkCorpusPart06Chunk03(root),
  ];
}

function createBenchmarkCorpusPart06Chunk01(root: string): BenchmarkScenario[] {
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
      description:
        "Warm full-repo .NET benchmark across build, test, metrics, and security stages.",
      fixturePath: fixture("test-projects/dotnet"),
      id: "dotnet-quality-full-repo-warm",
      inputs: ["."],
      kind: "warm",
      metadata: {
        languages: ["dotnet"],
        scale: "medium",
        shape: "full-repo",
        tags: ["dotnet", "full-repo", "medium", "quality", "security", "warm"],
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
        "security",
      ],
      warmupRuns: 1,
    },
    {
      budget: {
        maxDurationMs: 20_000,
        maxStageDurationMs: { lint: 20_000 },
      },
      description: "Cold full-repo lint benchmark for the .NET fixture.",
      fixturePath: fixture("test-projects/dotnet"),
      id: "dotnet-lint-full-repo-cold",
      inputs: ["."],
      kind: "cold",
      metadata: {
        languages: ["dotnet"],
        scale: "medium",
        shape: "full-repo",
        tags: ["cold", "dotnet", "full-repo", "lint", "medium"],
      },
      profile: "standard",
      stages: ["lint"],
    },
    {
      budget: {
        maxDurationMs: 20_000,
        maxStageDurationMs: { lint: 20_000 },
      },
      description: "Cold single-file lint benchmark for the .NET fixture.",
      fixturePath: fixture("test-projects/dotnet"),
      id: "dotnet-lint-single-file-cold",
      inputs: ["src/DotNetFixture/Greeter.cs"],
      kind: "cold",
      metadata: {
        languages: ["dotnet"],
        scale: "medium",
        shape: "single-file",
        tags: ["cold", "dotnet", "lint", "medium", "single-file"],
      },
      profile: "fast",
      stages: ["lint"],
    },
    {
      budget: {
        maxDurationMs: 20_000,
        maxStageDurationMs: { format: 20_000 },
      },
      description: "Diff-only single-file format benchmark for the .NET fixture.",
      fixturePath: fixture("test-projects/dotnet"),
      id: "dotnet-format-single-file-diff",
      inputs: ["src/DotnetProject/Program.cs"],
      kind: "diff-only",
      metadata: {
        languages: ["dotnet"],
        scale: "medium",
        shape: "single-file",
        tags: ["diff-only", "dotnet", "format", "medium", "single-file"],
      },
      profile: "fast",
      stages: ["format"],
    },
  ];
}

function createBenchmarkCorpusPart06Chunk02(root: string): BenchmarkScenario[] {
  const fixture = (relativePath: string): string => path.resolve(root, relativePath);

  return [
    {
      budget: {
        maxDurationMs: 60_000,
        maxStageDurationMs: { typecheck: 60_000 },
      },
      description: "Warm multi-file typecheck benchmark for the .NET fixture.",
      fixturePath: fixture("test-projects/dotnet"),
      id: "dotnet-typecheck-multi-file-warm",
      inputs: ["src/DotNetFixture/Greeter.cs", "tests/DotNetFixture.Tests/GreeterTests.cs"],
      kind: "warm",
      metadata: {
        languages: ["dotnet"],
        scale: "medium",
        shape: "multi-file",
        tags: ["dotnet", "medium", "multi-file", "typecheck", "warm"],
      },
      profile: "standard",
      stages: ["typecheck"],
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
      description: "Warm full-repo Java benchmark across JVM quality stages.",
      fixturePath: fixture("test-projects/java-maven"),
      id: "java-quality-full-repo-warm",
      inputs: ["."],
      kind: "warm",
      metadata: {
        languages: ["java"],
        scale: "medium",
        shape: "full-repo",
        tags: ["full-repo", "java", "medium", "quality", "warm"],
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
        maxDurationMs: 20_000,
        maxStageDurationMs: { lint: 20_000 },
      },
      description: "Cold full-repo lint benchmark for the Java fixture.",
      fixturePath: fixture("test-projects/java-maven"),
      id: "java-lint-full-repo-cold",
      inputs: ["."],
      kind: "cold",
      metadata: {
        languages: ["java"],
        scale: "medium",
        shape: "full-repo",
        tags: ["cold", "full-repo", "java", "lint", "medium"],
      },
      profile: "standard",
      stages: ["lint"],
    },
    {
      budget: {
        maxDurationMs: 20_000,
        maxStageDurationMs: { lint: 20_000 },
      },
      description: "Cold single-file lint benchmark for the Java fixture.",
      fixturePath: fixture("test-projects/java-maven"),
      id: "java-lint-single-file-cold",
      inputs: ["src/main/java/dev/aiq/fixture/Greeting.java"],
      kind: "cold",
      metadata: {
        languages: ["java"],
        scale: "medium",
        shape: "single-file",
        tags: ["cold", "java", "lint", "medium", "single-file"],
      },
      profile: "fast",
      stages: ["lint"],
    },
  ];
}

function createBenchmarkCorpusPart06Chunk03(root: string): BenchmarkScenario[] {
  const fixture = (relativePath: string): string => path.resolve(root, relativePath);

  return [
    {
      budget: {
        maxDurationMs: 60_000,
        maxStageDurationMs: { unit: 60_000 },
      },
      description: "Warm multi-file unit benchmark for the Java fixture.",
      fixturePath: fixture("test-projects/java-maven"),
      id: "java-unit-multi-file-warm",
      inputs: [
        "src/main/java/dev/aiq/fixture/Greeting.java",
        "src/test/java/dev/aiq/fixture/GreetingTest.java",
      ],
      kind: "warm",
      metadata: {
        languages: ["java"],
        scale: "medium",
        shape: "multi-file",
        tags: ["java", "medium", "multi-file", "unit", "warm"],
      },
      profile: "standard",
      stages: ["unit"],
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
      description: "Warm full-repo Kotlin benchmark across JVM quality stages.",
      fixturePath: fixture("test-projects/kotlin-gradle"),
      id: "kotlin-quality-full-repo-warm",
      inputs: ["."],
      kind: "warm",
      metadata: {
        languages: ["kotlin"],
        scale: "medium",
        shape: "full-repo",
        tags: ["full-repo", "kotlin", "medium", "quality", "warm"],
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
