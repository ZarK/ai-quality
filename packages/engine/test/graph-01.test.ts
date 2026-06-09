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
  it("maps overlapping TypeScript and JavaScript package ownership for a source file", async () => {
    const workspace = await createTypeScriptWorkspace();
    const manifest = await normalizeFileManifest(
      {
        files: [workspace.sourceFile],
        source: "direct",
      },
      workspace.root,
    );

    const graph = await buildProjectGraph(manifest);

    expect(graph.fileToProjectIds[workspace.sourceFile]).toEqual([
      `javascript-package:${workspace.packageJsonPath}`,
      `typescript-typecheck:${workspace.tsconfigPath}`,
    ]);

    await expect(selectJavaScriptProjects(graph, [workspace.sourceFile])).resolves.toEqual({
      projects: [
        {
          executionMode: "npm",
          files: [workspace.sourceFile],
          projectRoot: workspace.root,
          runner: "vitest",
        },
      ],
      unsupportedProjectRoots: [],
    });

    expect(selectTypeScriptProjects(graph, [workspace.sourceFile])).toEqual({
      projects: [
        {
          files: [workspace.sourceFile],
          projectRoot: workspace.root,
          tsconfigPath: workspace.tsconfigPath,
        },
      ],
      unsupportedFiles: [],
    });
  });
});
