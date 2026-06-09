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
  it("runs terraform typecheck and reports validation diagnostics with ranges", async () => {
    const project = await createTerraformFixtureProject("aiq-tf-typecheck-");
    await writeFile(
      project.mainFile,
      [
        "terraform {",
        '  required_version = ">= 1.0.0"',
        "}",
        "",
        'output "effective_region" {',
        "  value = local.missing_region",
        "}",
        "",
      ].join("\n"),
      "utf8",
    );

    const result = await runPlannedTask(
      {
        fileCount: 1,
        files: [project.mainFile],
        id: "test-run:terraform:typecheck-fail",
        stageId: "typecheck",
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
      severity: "error",
      source: "terraform-validate",
    });
    expect(result.diagnostics[0]?.message).toContain("Reference to undeclared local value");
    expect(result.diagnostics[0]?.range).toMatchObject({
      startLine: 6,
    });
    expect(result.toolRuns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "passed", tool: "terraform-init" }),
        expect.objectContaining({ status: "failed", tool: "terraform-validate" }),
      ]),
    );
  }, 20_000);
});
