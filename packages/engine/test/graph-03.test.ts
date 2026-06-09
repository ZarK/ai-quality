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
  it("fails async JavaScript graph selection when package metadata is invalid", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "aiq-engine-graph-js-invalid-"));
    tempDirs.push(root);

    const srcDir = path.join(root, "src");
    await mkdir(srcDir, { recursive: true });

    const sourceFile = path.join(srcDir, "index.ts");
    const packageJsonPath = path.join(root, "package.json");

    await writeFile(packageJsonPath, "{\n", "utf8");
    await writeFile(sourceFile, "export const answer = 42;\n", "utf8");

    const manifest = await normalizeFileManifest(
      {
        files: [sourceFile],
        source: "direct",
      },
      root,
    );

    const graph = await buildProjectGraph(manifest);

    await expect(selectJavaScriptProjects(graph, [sourceFile])).rejects.toThrow(
      `Failed to read package metadata at "${packageJsonPath}"`,
    );
  });
});
