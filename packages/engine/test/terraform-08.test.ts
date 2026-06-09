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
  it("runs generic HCL format and reports formatting diagnostics", async () => {
    const project = await createHclFixtureProject("aiq-hcl-format-");
    await writeFile(project.configFile, 'container "web"{image="nginx:latest"}\n', "utf8");

    const result = await runPlannedTask(
      {
        fileCount: 1,
        files: [project.configFile],
        id: "test-run:hcl:format",
        stageId: "format",
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
      message: "File requires formatting.",
      severity: "error",
      source: "terraform-hcl-format",
    });
    expect(result.toolRuns[0]).toMatchObject({
      exitCode: 3,
      status: "failed",
      tool: "terraform-hcl-format",
    });
  }, 20_000);
});
