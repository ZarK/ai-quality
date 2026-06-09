import { describe, expect, it, vi } from "vitest";
import {
  os,
  path,
  commandAvailable,
  cp,
  createHclFixtureProject,
  createTerraformFixtureProject,
  createTerraformJsonFixtureProject,
  execFileSync,
  fakeGitHubToken,
  fixtureHclRoot,
  fixtureTerraformRoot,
  hasTerraform,
  mkdir,
  mkdtemp,
  rm,
  runPlannedTask,
  stat,
  tempDirs,
  utimes,
  writeFile,
} from "./terraform-test-helpers.js";

describe("Terraform and HCL runners", () => {
  it("invalidates cached terraform validation when sibling terraform files change", async () => {
    const project = await createTerraformFixtureProject("aiq-tf-cache-invalidation-");

    const lint = await runPlannedTask(
      {
        fileCount: 1,
        files: [project.mainFile],
        id: "test-run:terraform:lint-cache-seed",
        stageId: "lint",
      },
      project.root,
    );

    if (!hasTerraform) {
      expect(lint.status).toBe("not_implemented");
      expect(lint.notes[0]).toContain("Install 'terraform'");
      return;
    }

    expect(lint.status).toBe("passed");
    const originalVariablesStats = await stat(project.variablesFile);

    await writeFile(
      project.variablesFile,
      ['variable "region" {', "  type    = string", '  default = "us-east-1"', "}"].join("\n"),
      "utf8",
    );
    await utimes(project.variablesFile, originalVariablesStats.atime, originalVariablesStats.mtime);

    const typecheck = await runPlannedTask(
      {
        fileCount: 1,
        files: [project.mainFile],
        id: "test-run:terraform:typecheck-cache-invalidation",
        stageId: "typecheck",
      },
      project.root,
    );

    expect(typecheck.status).toBe("passed");
    expect(typecheck.notes.join(" ")).not.toContain("Reused cached Terraform validation");
    expect(typecheck.diagnostics).toEqual([]);
    expect(typecheck.toolRuns.some((toolRun) => toolRun.cacheHit)).toBe(false);
    expect(typecheck.toolRuns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cacheHit: false, status: "passed", tool: "terraform-init" }),
        expect.objectContaining({
          cacheHit: false,
          status: "passed",
          tool: "terraform-validate",
        }),
      ]),
    );
  }, 20_000);
});
