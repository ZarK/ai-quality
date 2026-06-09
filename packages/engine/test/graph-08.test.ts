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
  it("groups Go files under the extracted graph selector", async () => {
    const workspace = await createGoWorkspace();
    const manifest = await normalizeFileManifest(
      {
        files: [workspace.moduleFile, workspace.sourceFile],
        source: "direct",
      },
      workspace.root,
    );

    const graph = await buildProjectGraph(manifest);

    expect(graph.fileToProjectIds[workspace.sourceFile]).toEqual([`go:${workspace.moduleFile}`]);
    expect(graph.fileToProjectIds[workspace.moduleFile]).toEqual([`go:${workspace.moduleFile}`]);
    expect(selectGoProjects(graph, [workspace.sourceFile])).toEqual({
      projects: [
        {
          files: [workspace.sourceFile],
          moduleFilePath: workspace.moduleFile,
          projectRoot: workspace.root,
        },
      ],
      unsupportedFiles: [],
    });
  });
});
