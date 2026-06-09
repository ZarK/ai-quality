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
  it("groups Rust files under the extracted graph selector", async () => {
    const workspace = await createRustWorkspace();
    const manifest = await normalizeFileManifest(
      {
        files: [workspace.manifestFile, workspace.sourceFile],
        source: "direct",
      },
      workspace.root,
    );

    const graph = await buildProjectGraph(manifest);

    expect(graph.fileToProjectIds[workspace.sourceFile]).toEqual([
      `rust:${workspace.manifestFile}`,
    ]);
    expect(graph.fileToProjectIds[workspace.manifestFile]).toEqual([
      `rust:${workspace.manifestFile}`,
    ]);
    expect(selectRustProjects(graph, [workspace.sourceFile])).toEqual({
      projects: [
        {
          files: [workspace.sourceFile],
          manifestPath: workspace.manifestFile,
          projectRoot: workspace.root,
        },
      ],
      unsupportedFiles: [],
    });
  });
});
