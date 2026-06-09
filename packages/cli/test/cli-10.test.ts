import { describe, expect, it } from "vitest";
import {
  path,
  MemoryInput,
  MemoryOutput,
  createTypeScriptFixtureProject,
  initializeGitRepository,
  runCli,
  writeFile,
} from "./cli-test-helpers.js";

describe("CLI foundation", () => {
  it("keeps full-run stages selected under diff-only without narrowing to safe-stage behavior", async () => {
    const project = await createTypeScriptFixtureProject("aiq-cli-diff-only-full-stage-");
    const siblingFile = path.join(project.root, "src", "sibling.ts");
    await writeFile(siblingFile, "export const sibling = 2;\n", "utf8");
    await initializeGitRepository(project.root);
    const stdout = new MemoryOutput();
    const stderr = new MemoryOutput();

    const exitCode = await runCli(
      [
        "node",
        "aiq",
        "run",
        "src/index.ts",
        "--stage",
        "lint",
        "--stage",
        "typecheck",
        "--diff-only",
        "--dry-run",
        "--format",
        "json",
      ],
      {
        cwd: project.root,
        stderr,
        stdin: new MemoryInput(),
        stdout,
      },
    );

    expect(exitCode).toBe(0);
    expect(stderr.value).toBe("");
    const output = JSON.parse(stdout.value) as {
      plan: { tasks: Array<{ files: string[]; stageId: string }> };
    };
    const changedFile = path.join(project.root, "src", "index.ts");
    const lintTask = output.plan.tasks.find((task) => task.stageId === "lint");
    const typecheckTask = output.plan.tasks.find((task) => task.stageId === "typecheck");
    expect(lintTask?.files).toEqual([changedFile]);
    expect(typecheckTask?.files).toContain(changedFile);
    expect(typecheckTask?.files).toContain(path.join(project.root, "tsconfig.json"));
    expect(typecheckTask?.files).toContain(siblingFile);
  });

  it("uses changed files only for every diff-only safe stage", async () => {
    const project = await createTypeScriptFixtureProject("aiq-cli-diff-only-safe-matrix-");
    const siblingFile = path.join(project.root, "src", "sibling.ts");
    await writeFile(siblingFile, "export const sibling = 2;\n", "utf8");
    const stdout = new MemoryOutput();
    const stderr = new MemoryOutput();
    const safeStages = ["lint", "format", "sloc", "complexity", "maintainability"];

    const exitCode = await runCli(
      [
        "node",
        "aiq",
        "run",
        "src/index.ts",
        ...safeStages.flatMap((stage) => ["--stage", stage]),
        "--diff-only",
        "--dry-run",
        "--format",
        "json",
      ],
      {
        cwd: project.root,
        stderr,
        stdin: new MemoryInput(),
        stdout,
      },
    );

    expect(exitCode).toBe(0);
    expect(stderr.value).toBe("");
    const output = JSON.parse(stdout.value) as {
      plan: { tasks: Array<{ files: string[]; stageId: string }> };
    };
    const changedFile = path.join(project.root, "src", "index.ts");
    for (const stage of safeStages) {
      expect(output.plan.tasks.find((task) => task.stageId === stage)?.files).toEqual([
        changedFile,
      ]);
    }
  });
});
