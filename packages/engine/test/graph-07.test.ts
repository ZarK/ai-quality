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
  it("groups Python fixture files under the extracted graph selector", async () => {
    const configFile = path.join(fixturePythonRoot, "pyproject.toml");
    const sourceFile = path.join(fixturePythonRoot, "main.py");
    const testFile = path.join(fixturePythonRoot, "tests", "test_main.py");
    const manifest = await normalizeFileManifest(
      {
        files: [configFile, sourceFile, testFile],
        source: "direct",
      },
      fixturePythonRoot,
    );

    const graph = await buildProjectGraph(manifest);

    expect(graph.fileToProjectIds[configFile]).toEqual([`python:${fixturePythonRoot}`]);
    expect(graph.fileToProjectIds[sourceFile]).toEqual([`python:${fixturePythonRoot}`]);
    expect(graph.fileToProjectIds[testFile]).toEqual([`python:${fixturePythonRoot}`]);
    expect(selectPythonProjects(graph, [configFile, sourceFile, testFile])).toEqual([
      {
        files: [sourceFile, configFile, testFile],
        projectRoot: fixturePythonRoot,
      },
    ]);
  });
});
