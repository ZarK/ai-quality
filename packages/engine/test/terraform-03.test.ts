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
  it("runs terraform format and reports formatting diagnostics", async () => {
    const project = await createTerraformFixtureProject("aiq-tf-format-");
    await writeFile(
      project.mainFile,
      [
        "terraform{",
        'required_version=">= 1.0.0"',
        "}",
        "locals{",
        "effective_region=var.region",
        "}",
        'output "effective_region"{',
        "value=local.effective_region",
        "}",
        "",
      ].join("\n"),
      "utf8",
    );

    const result = await runPlannedTask(
      {
        fileCount: 1,
        files: [project.mainFile],
        id: "test-run:terraform:format",
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
      file: project.mainFile,
      message: "File requires formatting.",
      severity: "error",
      source: "terraform-fmt",
    });
    expect(result.toolRuns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ exitCode: 3, status: "failed", tool: "terraform-fmt" }),
      ]),
    );
  }, 20_000);
});
