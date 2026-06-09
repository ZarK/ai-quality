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
  it("does not copy prebuilt dist directories into benchmark workspaces", async () => {
    const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "aiq-benchmark-fixture-"));
    const outDir = await mkdtemp(path.join(os.tmpdir(), "aiq-benchmark-"));
    tempDirs.push(fixtureRoot, outDir);

    await writeFile(
      path.join(fixtureRoot, "index.js"),
      "export const greet = () => 'hi';\n",
      "utf8",
    );
    await mkdir(path.join(fixtureRoot, "dist", "nested"), { recursive: true });
    await writeFile(
      path.join(fixtureRoot, "dist", "nested", "bundle.js"),
      "stale-bundle\n",
      "utf8",
    );

    const { report } = await runBenchmarkSuite({
      cwd: process.cwd(),
      outDir,
      scenarios: [
        {
          budget: {
            maxDurationMs: 20_000,
            maxStageDurationMs: { lint: 20_000 },
          },
          description: "Ignore prebuilt dist directories in benchmark workspaces.",
          fixturePath: fixtureRoot,
          id: "javascript-dist-isolation",
          inputs: ["."],
          kind: "cold",
          metadata: {
            languages: ["javascript"],
            scale: "small",
            shape: "full-repo",
            tags: ["dist", "isolation", "javascript"],
          },
          profile: "fast",
          stages: ["lint"],
        },
      ],
    });

    expect(report.scenarios[0]?.manifest.files).toEqual(["index.js"]);
  });
});
