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
  it("runs Terraform lint and reuses cached validation for typecheck", async () => {
    const project = await createTerraformFixtureProject("aiq-tf-lint-typecheck-");

    const lint = await runPlannedTask(
      {
        fileCount: 1,
        files: [project.mainFile],
        id: "test-run:terraform:lint",
        stageId: "lint",
      },
      project.root,
    );
    const typecheck = await runPlannedTask(
      {
        fileCount: 1,
        files: [project.mainFile],
        id: "test-run:terraform:typecheck",
        stageId: "typecheck",
      },
      project.root,
    );

    if (!hasTerraform) {
      expect(lint.status).toBe("not_implemented");
      expect(typecheck.status).toBe("not_implemented");
      expect(lint.notes[0]).toContain("Install 'terraform'");
      expect(typecheck.notes[0]).toContain("Install 'terraform'");
      return;
    }

    expect(lint.status).toBe("passed");
    expect(lint.diagnostics).toEqual([]);
    expect(lint.notes[0]).toContain("terraform validate passed");
    expect(lint.toolRuns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cacheHit: false, status: "passed", tool: "terraform-init" }),
        expect.objectContaining({
          cacheHit: false,
          status: "passed",
          tool: "terraform-validate",
        }),
      ]),
    );

    expect(typecheck.status).toBe("passed");
    expect(typecheck.diagnostics).toEqual([]);
    expect(typecheck.notes.join(" ")).toContain("Reused cached Terraform validation");
    expect(typecheck.toolRuns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cacheHit: true, status: "passed", tool: "terraform-init" }),
        expect.objectContaining({
          cacheHit: true,
          status: "passed",
          tool: "terraform-validate",
        }),
      ]),
    );
  }, 20_000);
});
