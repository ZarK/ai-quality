import { describe, expect, it, vi } from "vitest";
import {
  os,
  path,
  buildProjectGraph,
  cp,
  createDotNetWorkspace,
  createGoWorkspace,
  createHashicorpWorkspace,
  createJvmWorkspace,
  createRustWorkspace,
  createScriptWorkspace,
  createTypeScriptWorkspace,
  fixtureBashRoot,
  fixtureDotNetRoot,
  fixtureGoRoot,
  fixtureJavaMavenRoot,
  fixturePowerShellRoot,
  fixturePythonRoot,
  fixtureRustRoot,
  mkdir,
  mkdtemp,
  normalizeFileManifest,
  rm,
  selectDotNetProjects,
  selectGoProjects,
  selectJavaScriptPackageProjects,
  selectJavaScriptProjects,
  selectJvmProjects,
  selectPythonProjects,
  selectRustProjects,
  selectScriptProjects,
  selectTerraformProjects,
  selectTypeScriptProjects,
  tempDirs,
  writeFile,
} from "./graph-test-helpers.js";

describe("project graph", () => {
  it("groups Terraform and HCL files under the shared extracted selector", async () => {
    const workspace = await createHashicorpWorkspace();
    const manifest = await normalizeFileManifest(
      {
        files: [workspace.terraformFile, workspace.hclFile],
        source: "direct",
      },
      workspace.root,
    );

    const graph = await buildProjectGraph(manifest);

    expect(graph.fileToProjectIds[workspace.terraformFile]).toEqual([
      `terraform-directory:${workspace.root}`,
    ]);
    expect(graph.fileToProjectIds[workspace.hclFile]).toEqual([
      `terraform-directory:${workspace.root}`,
    ]);
    expect(selectTerraformProjects(graph, [workspace.terraformFile, workspace.hclFile])).toEqual([
      {
        files: [workspace.hclFile, workspace.terraformFile],
        hclFiles: [workspace.hclFile],
        projectRoot: workspace.root,
        terraformFiles: [workspace.terraformFile],
      },
    ]);
  });
});
