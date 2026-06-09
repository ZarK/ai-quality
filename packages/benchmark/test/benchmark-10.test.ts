import { describe, expect, it, vi } from "vitest";
import {
  os,
  path,
  access,
  benchmarkTypeScriptLargeFixturePath,
  createDefaultBenchmarkCorpus,
  filterBenchmarkScenarios,
  formatBenchmarkReportAsJson,
  formatBenchmarkReportAsText,
  hasDotNet10Toolchain,
  hasFullBenchmarkToolchain,
  hasGoToolchain,
  hasGradleToolchain,
  hasMavenToolchain,
  hasPythonQualityToolchain,
  hasRustToolchain,
  hasTaggedCiBenchmarkToolchain,
  issue96ScenarioIds,
  lintFailureFixturePath,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  runBenchmarkSuite,
  runBenchmarkSuiteAndEnforceBudgets,
  tempDirs,
  writeFile,
} from "./benchmark-test-helpers.js";

describe("benchmark harness", () => {
  it("cleans up temporary benchmark workspaces after a run", async () => {
    const fixtureParent = await mkdtemp(path.join(os.tmpdir(), "aiq-benchmark-parent-"));
    const fixtureRoot = path.join(fixtureParent, "fixture");
    const outDir = await mkdtemp(path.join(os.tmpdir(), "aiq-benchmark-"));
    tempDirs.push(fixtureParent, outDir);

    await mkdir(fixtureRoot, { recursive: true });
    await writeFile(
      path.join(fixtureRoot, "index.js"),
      "export const greet = () => 'hi';\n",
      "utf8",
    );

    await runBenchmarkSuite({
      cwd: process.cwd(),
      outDir,
      scenarios: [
        {
          budget: {
            maxDurationMs: 20_000,
            maxStageDurationMs: { lint: 20_000 },
          },
          description: "Clean up temporary benchmark workspaces after execution.",
          fixturePath: fixtureRoot,
          id: "javascript-temp-cleanup",
          inputs: ["."],
          kind: "cold",
          metadata: {
            languages: ["javascript"],
            scale: "small",
            shape: "full-repo",
            tags: ["cleanup", "javascript"],
          },
          profile: "fast",
          stages: ["lint"],
        },
      ],
    });

    const remainingEntries = await readdir(fixtureParent);
    expect(remainingEntries).toEqual(["fixture"]);
  });
});
