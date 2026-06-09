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
  it("runs Terraform lint for terraform json inputs", async () => {
    const project = await createTerraformJsonFixtureProject("aiq-tf-json-lint-");

    const result = await runPlannedTask(
      {
        fileCount: 1,
        files: [project.terraformJsonFile],
        id: "test-run:terraform-json:lint",
        stageId: "lint",
      },
      project.root,
    );

    if (!hasTerraform) {
      expect(result.status).toBe("not_implemented");
      expect(result.notes[0]).toContain("Install 'terraform'");
      return;
    }

    expect(result.status).toBe("passed");
    expect(result.diagnostics).toEqual([]);
    expect(result.toolRuns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "passed", tool: "terraform-init" }),
        expect.objectContaining({ status: "passed", tool: "terraform-validate" }),
      ]),
    );
  }, 20_000);
});
