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
  it("groups JVM source files under the extracted selector", async () => {
    const workspace = await createJvmWorkspace();
    const manifest = await normalizeFileManifest(
      {
        files: [workspace.buildFile, workspace.sourceFile],
        source: "direct",
      },
      workspace.root,
    );

    const graph = await buildProjectGraph(manifest);

    expect(graph.fileToProjectIds[workspace.sourceFile]).toEqual([`jvm:${workspace.buildFile}`]);
    expect(graph.fileToProjectIds[workspace.buildFile]).toEqual([`jvm:${workspace.buildFile}`]);
    expect(selectJvmProjects(graph, [workspace.sourceFile])).toEqual({
      projects: [
        {
          buildFilePath: workspace.buildFile,
          buildSystem: "maven",
          files: [workspace.sourceFile],
          projectRoot: workspace.root,
        },
      ],
      unsupportedFiles: [],
    });
  });
});
