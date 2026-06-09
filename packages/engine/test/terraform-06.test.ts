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
  it("runs generic HCL lint on valid files", async () => {
    const project = await createHclFixtureProject("aiq-hcl-lint-");

    const result = await runPlannedTask(
      {
        fileCount: 1,
        files: [project.configFile],
        id: "test-run:hcl:lint",
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
    expect(result.notes[0]).toContain("Generic HCL syntax check passed");
    expect(result.toolRuns[0]).toMatchObject({
      exitCode: 0,
      status: "passed",
      tool: "terraform-hcl-lint",
    });
  }, 20_000);
});
