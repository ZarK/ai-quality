import { describe, expect, it, vi } from "vitest";
import {
  os,
  path,
  buildEngineContext,
  buildProjectGraph,
  buildProjectGraphWithModules,
  combineStageResults,
  commandAvailable,
  createCombinedStageDefinition,
  createGraphLanguageModuleRegistry,
  createNoopStageResult,
  createNotImplementedStageResult,
  createRunnerExecutionContext,
  createRunnerLanguageModuleRegistry,
  createStageResult,
  createTempFile,
  defaultGraphLanguageModules,
  defaultRunnerLanguageModules,
  defaultStageDefinitions,
  execFileSync,
  fixtureBashFile,
  fixtureDotNetFile,
  fixtureGoFile,
  fixtureJavaMavenFile,
  fixturePowerShellFile,
  fixturePythonConfigFile,
  fixtureRustFile,
  fixtureTerraformFile,
  hasDotNet10Toolchain,
  hasGoToolchain,
  hasMavenToolchain,
  hasPowerShellPesterToolchain,
  hasPythonQualityToolchain,
  hasRustToolchain,
  mkdir,
  mkdtemp,
  normalizeFileManifest,
  resolveStageHandlersFromModules,
  rm,
  runnerExecutionContextStorage,
  tempDirs,
  writeFile,
} from "./modularity-test-helpers.js";

describe("engine modular authoring path", () => {
  it("builds graphs from injected language modules without touching the default registry", async () => {
    const project = await createTempFile("src/example.synthetic", "value\n");
    const manifest = await normalizeFileManifest(
      { files: [project.file], source: "direct" },
      project.root,
    );

    const modules = createGraphLanguageModuleRegistry([
      {
        id: "synthetic",
        async discoverProjects(file): Promise<ProjectDescriptor[]> {
          const resolvedFile = path.resolve(file);
          if (!resolvedFile.endsWith(".synthetic")) {
            return [];
          }

          return [
            {
              ecosystem: "unknown",
              id: `synthetic:${resolvedFile}`,
              language: "synthetic",
              manifestFiles: [],
              metadata: { kind: "synthetic" },
              name: "synthetic project",
              root: path.dirname(resolvedFile),
              sourceFiles: [resolvedFile],
            },
          ];
        },
      },
    ]);

    const graph = await buildProjectGraphWithModules(manifest, modules);

    expect(graph.projects).toEqual([
      {
        ecosystem: "unknown",
        id: `synthetic:${project.file}`,
        language: "synthetic",
        manifestFiles: [],
        metadata: { kind: "synthetic" },
        name: "synthetic project",
        root: path.dirname(project.file),
        sourceFiles: [project.file],
      },
    ]);
    expect(graph.fileToProjectIds[project.file]).toEqual([`synthetic:${project.file}`]);
  });
});
