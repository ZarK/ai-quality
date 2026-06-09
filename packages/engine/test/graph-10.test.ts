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
  it("groups Bash files under the shared script selector", async () => {
    const workspace = await createScriptWorkspace(
      fixtureBashRoot,
      "aiq-engine-graph-bash-",
      "example.sh",
    );
    const manifest = await normalizeFileManifest(
      {
        files: [workspace.packageJsonFile, workspace.sourceFile],
        source: "direct",
      },
      workspace.root,
    );

    const graph = await buildProjectGraph(manifest);

    expect(graph.fileToProjectIds[workspace.sourceFile]).toEqual([`script:${workspace.root}`]);
    expect(selectScriptProjects(graph, [workspace.sourceFile])).toEqual([
      {
        files: [workspace.sourceFile],
        projectRoot: workspace.root,
      },
    ]);
  });
});
