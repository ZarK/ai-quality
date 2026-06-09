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
  it("reuses the JavaScript project lookup across a single selection pass", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "aiq-engine-graph-js-selection-"));
    tempDirs.push(root);

    const packageARoot = path.join(root, "package-a");
    const packageBRoot = path.join(root, "package-b");
    const packageAFile = path.join(packageARoot, "src", "index.ts");
    const packageBFile = path.join(packageBRoot, "src", "index.ts");

    await mkdir(path.dirname(packageAFile), { recursive: true });
    await mkdir(path.dirname(packageBFile), { recursive: true });
    await writeFile(
      path.join(packageARoot, "package.json"),
      `${JSON.stringify({ name: "package-a", private: true }, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      path.join(packageBRoot, "package.json"),
      `${JSON.stringify({ name: "package-b", private: true }, null, 2)}\n`,
      "utf8",
    );
    await writeFile(packageAFile, "export const packageA = 1;\n", "utf8");
    await writeFile(packageBFile, "export const packageB = 2;\n", "utf8");

    const manifest = await normalizeFileManifest(
      {
        files: [packageAFile, packageBFile],
        source: "direct",
      },
      root,
    );

    const graph = await buildProjectGraph(manifest);
    const instrumentedProjects = [...graph.projects];
    const originalMap = instrumentedProjects.map.bind(instrumentedProjects);
    let mapCalls = 0;

    instrumentedProjects.map = function map(callbackfn, thisArg) {
      mapCalls += 1;
      return originalMap(callbackfn, thisArg);
    };

    expect(
      selectJavaScriptPackageProjects(
        {
          ...graph,
          projects: instrumentedProjects,
        },
        [packageAFile, packageBFile],
      ),
    ).toEqual({
      projects: [
        {
          files: [packageAFile],
          packageJsonPath: path.join(packageARoot, "package.json"),
          projectRoot: packageARoot,
        },
        {
          files: [packageBFile],
          packageJsonPath: path.join(packageBRoot, "package.json"),
          projectRoot: packageBRoot,
        },
      ],
      unsupportedFiles: [],
    });
    expect(mapCalls).toBe(1);
  });
});
