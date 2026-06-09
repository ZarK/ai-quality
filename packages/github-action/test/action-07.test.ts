import { describe, expect, it, vi } from "vitest";
import {
  os,
  path,
  MemoryGitHubActionIo,
  access,
  createGitRepo,
  createRunResult,
  defaultConfig,
  execFile,
  execFileAsync,
  mkdir,
  mkdtemp,
  parseGitHubActionStageInput,
  parsePositiveInteger,
  promisify,
  readFile,
  rm,
  runAiqGitHubAction,
  tempDirs,
  writeFile,
} from "./action-test-helpers.js";

describe("github action adapter", () => {
  it("uses the canonical report artifact for annotations instead of the in-memory result", async () => {
    const repoDir = await createGitRepo({
      "src/index.ts": "const value = 1;\nexport { value };\n",
    });
    const outDir = path.join(repoDir, ".aiq", "out");
    await mkdir(outDir, { recursive: true });

    const planPath = path.join(outDir, "aiq.plan.json");
    const reportPath = path.join(outDir, "aiq.report.json");
    await writeFile(planPath, "{}\n", "utf8");

    const canonicalReport = createRunResult({
      cwd: repoDir,
      diagnostics: [
        {
          file: path.join(repoDir, "src/index.ts"),
          message: "Canonical artifact warning",
          severity: "warning",
          source: "aiq",
        },
      ],
      outDir,
      reportPath,
      status: "failed",
    });
    await writeFile(reportPath, `${JSON.stringify(canonicalReport, null, 2)}\n`, "utf8");

    const io = new MemoryGitHubActionIo();
    const inMemoryResult = createRunResult({
      cwd: repoDir,
      diagnostics: [],
      outDir,
      reportPath,
      status: "passed",
    });

    await runAiqGitHubAction(
      io,
      {
        cwd: repoDir,
        files: ["src/index.ts"],
      },
      {
        runEngineImpl: async () => inMemoryResult,
      },
    );

    expect(io.annotations).toEqual([
      {
        file: "src/index.ts",
        level: "warning",
        message: "Canonical artifact warning",
        title: "AIQ/aiq",
      },
    ]);
    expect(io.outputs.get("status")).toBe("failed");
    expect(io.uploads[0]?.rootDirectory).toBe(outDir);
  });
});
