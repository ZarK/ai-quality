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
  it("runs the shared security scan for Terraform and HCL inputs", async () => {
    const terraformProject = await createTerraformFixtureProject("aiq-tf-security-");
    const hclProject = await createHclFixtureProject("aiq-hcl-security-");

    await writeFile(
      terraformProject.mainFile,
      [
        "terraform {",
        '  required_version = ">= 1.0.0"',
        "}",
        "",
        `locals { token = "${fakeGitHubToken}" }`,
        "",
      ].join("\n"),
      "utf8",
    );
    await writeFile(
      hclProject.configFile,
      [`locals { token = "${fakeGitHubToken}" }`, ""].join("\n"),
      "utf8",
    );

    const result = await runPlannedTask(
      {
        fileCount: 2,
        files: [terraformProject.mainFile, hclProject.configFile],
        id: "test-run:terraform-hcl:security",
        stageId: "security",
      },
      terraformProject.root,
    );

    expect(result.status).toBe("failed");
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: terraformProject.mainFile,
          severity: "error",
          source: "aiq-security",
        }),
        expect.objectContaining({
          file: hclProject.configFile,
          severity: "error",
          source: "aiq-security",
        }),
      ]),
    );
    expect(result.toolRuns[0]).toMatchObject({
      exitCode: 1,
      status: "failed",
      tool: "aiq-security",
    });
  });
});
