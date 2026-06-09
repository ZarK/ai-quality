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
  it("runs generic HCL lint and reports syntax diagnostics", async () => {
    const project = await createHclFixtureProject("aiq-hcl-lint-fail-");
    await writeFile(
      project.configFile,
      ['container "web" {', "  image =", "}", ""].join("\n"),
      "utf8",
    );

    const result = await runPlannedTask(
      {
        fileCount: 1,
        files: [project.configFile],
        id: "test-run:hcl:lint-fail",
        stageId: "lint",
      },
      project.root,
    );

    if (!hasTerraform) {
      expect(result.status).toBe("not_implemented");
      expect(result.notes[0]).toContain("Install 'terraform'");
      return;
    }

    expect(result.status).toBe("failed");
    expect(result.diagnostics[0]).toMatchObject({
      file: project.configFile,
      severity: "error",
      source: "terraform-hcl-lint",
    });
    expect(result.diagnostics[0]?.range).toMatchObject({
      startLine: 2,
    });
    expect(result.toolRuns[0]).toMatchObject({
      status: "failed",
      tool: "terraform-hcl-lint",
    });
  }, 20_000);
});
