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
  it("records both dotnet project and solution ownership and honors selector preference", async () => {
    const workspace = await createDotNetWorkspace();
    const manifest = await normalizeFileManifest(
      {
        files: [workspace.projectFile, workspace.sourceFile],
        source: "direct",
      },
      workspace.root,
    );

    const graph = await buildProjectGraph(manifest);

    expect(graph.fileToProjectIds[workspace.sourceFile]).toEqual([
      `dotnet-project:${workspace.projectFile}`,
      `dotnet-solution:${workspace.solutionFile}`,
    ]);

    expect(graph.fileToProjectIds[workspace.projectFile]).toEqual([
      `dotnet-project:${workspace.projectFile}`,
      `dotnet-solution:${workspace.solutionFile}`,
    ]);

    expect(selectDotNetProjects(graph, [workspace.sourceFile], "prefer-project")).toEqual({
      projects: [
        {
          files: [workspace.sourceFile],
          projectRoot: path.dirname(workspace.projectFile),
          targetPath: workspace.projectFile,
        },
      ],
      unsupportedFiles: [],
    });

    expect(selectDotNetProjects(graph, [workspace.sourceFile], "prefer-solution")).toEqual({
      projects: [
        {
          files: [workspace.sourceFile],
          projectRoot: workspace.root,
          targetPath: workspace.solutionFile,
        },
      ],
      unsupportedFiles: [],
    });

    expect(selectDotNetProjects(graph, [workspace.projectFile], "prefer-project")).toEqual({
      projects: [
        {
          files: [workspace.projectFile],
          projectRoot: path.dirname(workspace.projectFile),
          targetPath: workspace.projectFile,
        },
      ],
      unsupportedFiles: [],
    });

    expect(selectDotNetProjects(graph, [workspace.projectFile], "prefer-solution")).toEqual({
      projects: [
        {
          files: [workspace.projectFile],
          projectRoot: workspace.root,
          targetPath: workspace.solutionFile,
        },
      ],
      unsupportedFiles: [],
    });
  });
});
