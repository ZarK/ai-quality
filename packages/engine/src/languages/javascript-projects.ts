import path from "node:path";

import type { ProjectDescriptor, ProjectGraph, ProjectMetadata } from "../contracts.js";
import {
  type JavaScriptTestExecutionMode,
  type JavaScriptTestRunner,
  detectJavaScriptTestRunner,
  findNearestPackageJson,
  javaScriptMetricsSourceExtensions,
  resolveJavaScriptTestExecutionMode,
} from "../utils/node-utils.js";
import type { JavaScriptRunnerRuntime } from "./contracts.js";
import { isJavaScriptMetricsTaskFile, isJavaScriptTestTaskFile } from "./javascript-files.js";

export type JavaScriptPackageProjectDescriptor = ProjectDescriptor & {
  metadata: ProjectMetadata & {
    kind: "javascript-package";
    packageJsonPath: string;
  };
};

export type JavaScriptPackageProject = {
  files: string[];
  packageJsonPath: string;
  projectRoot: string;
};

export type JavaScriptProject = {
  executionMode: JavaScriptTestExecutionMode;
  files: string[];
  projectRoot: string;
  runner: JavaScriptTestRunner;
};

export type JavaScriptMetricsProject = {
  files: string[];
  packageJsonPath: string;
  projectRoot: string;
};

export type JavaScriptE2eProject = {
  files: string[];
  packageJsonPath: string;
  projectRoot: string;
};

export async function discoverJavaScriptProjects(file: string): Promise<ProjectDescriptor[]> {
  const project = await createJavaScriptPackageProject(file);
  return project === undefined ? [] : [project];
}

export function selectJavaScriptPackageProjects(
  graph: ProjectGraph,
  files: readonly string[],
): { projects: JavaScriptPackageProject[]; unsupportedFiles: string[] } {
  const grouped = selectSingleKindProjects(graph, files, "javascript-package");

  return {
    projects: grouped.projects.map((project) => ({
      files: project.files,
      packageJsonPath: project.metadata.packageJsonPath,
      projectRoot: project.root,
    })),
    unsupportedFiles: grouped.unsupportedFiles,
  };
}

export async function selectJavaScriptProjects(
  graph: ProjectGraph,
  files: readonly string[],
): Promise<{ projects: JavaScriptProject[]; unsupportedProjectRoots: string[] }> {
  return resolveSelectedJavaScriptProjects(selectJavaScriptPackageProjects(graph, files));
}

async function createJavaScriptPackageProject(
  file: string,
): Promise<JavaScriptPackageProjectDescriptor | undefined> {
  const resolvedFile = path.resolve(file);
  if (!isJavaScriptMetricsTaskFile(resolvedFile)) {
    return undefined;
  }

  const packageJsonPath = await findNearestPackageJson(resolvedFile);
  if (packageJsonPath === undefined) {
    return undefined;
  }

  const projectRoot = path.dirname(packageJsonPath);

  return {
    ecosystem: "javascript",
    id: `javascript-package:${packageJsonPath}`,
    language: "javascript",
    manifestFiles: [packageJsonPath],
    metadata: {
      kind: "javascript-package",
      packageJsonPath,
    },
    name: readProjectName(projectRoot),
    root: projectRoot,
    sourceFiles: [resolvedFile],
  };
}

export async function resolveJavaScriptProjects(
  graph: ProjectGraph | undefined,
  files: readonly string[],
): Promise<{ projects: JavaScriptProject[]; unsupportedProjectRoots: string[] }> {
  if (graph !== undefined) {
    return selectJavaScriptProjects(graph, files);
  }

  return resolveSelectedJavaScriptProjects(await resolveFallbackJavaScriptPackageProjects(files));
}

async function resolveSelectedJavaScriptProjects(packageProjects: {
  projects: JavaScriptPackageProject[];
  unsupportedFiles: string[];
}): Promise<{ projects: JavaScriptProject[]; unsupportedProjectRoots: string[] }> {
  const unsupportedProjectRoots = new Set<string>();

  for (const file of packageProjects.unsupportedFiles) {
    unsupportedProjectRoots.add(path.dirname(file));
  }

  const projects = await Promise.all(
    packageProjects.projects.map(async (project) => {
      const runner = await detectJavaScriptTestRunner(project.projectRoot);
      if (runner === undefined) {
        unsupportedProjectRoots.add(project.projectRoot);
        return undefined;
      }

      return {
        executionMode: await resolveJavaScriptTestExecutionMode(project.projectRoot, runner),
        files: project.files,
        projectRoot: project.projectRoot,
        runner,
      };
    }),
  );

  return {
    projects: projects
      .filter((project): project is JavaScriptProject => project !== undefined)
      .sort((left, right) => left.projectRoot.localeCompare(right.projectRoot)),
    unsupportedProjectRoots: [...unsupportedProjectRoots].sort((left, right) =>
      left.localeCompare(right),
    ),
  };
}

async function resolveFallbackJavaScriptPackageProjects(files: readonly string[]): Promise<{
  projects: JavaScriptPackageProject[];
  unsupportedFiles: string[];
}> {
  return resolvePackageProjectsFromFiles(files, isJavaScriptTestTaskFile);
}

export async function resolveJavaScriptMetricsProjects(
  graph: ProjectGraph | undefined,
  files: readonly string[],
): Promise<{ projects: JavaScriptMetricsProject[]; unsupportedFiles: string[] }> {
  if (graph !== undefined) {
    const grouped = selectJavaScriptPackageProjects(graph, files);
    return {
      projects: grouped.projects.map((project) => ({
        files: project.files,
        packageJsonPath: project.packageJsonPath,
        projectRoot: project.projectRoot,
      })),
      unsupportedFiles: grouped.unsupportedFiles,
    };
  }

  return resolvePackageProjectsFromFiles(files, isJavaScriptMetricsTaskFile);
}

export async function resolveJavaScriptE2eProjects(
  graph: ProjectGraph | undefined,
  files: readonly string[],
): Promise<{ projects: JavaScriptE2eProject[]; unsupportedFiles: string[] }> {
  if (graph !== undefined) {
    const grouped = selectJavaScriptPackageProjects(graph, files);
    return {
      projects: grouped.projects.map((project) => ({
        files: project.files,
        packageJsonPath: project.packageJsonPath,
        projectRoot: project.projectRoot,
      })),
      unsupportedFiles: grouped.unsupportedFiles,
    };
  }

  return resolvePackageProjectsFromFiles(files, isJavaScriptTestTaskFile);
}

async function resolvePackageProjectsFromFiles(
  files: readonly string[],
  isSupportedFile: (file: string) => boolean,
): Promise<{ projects: JavaScriptPackageProject[]; unsupportedFiles: string[] }> {
  const projectFiles = new Map<string, string[]>();
  const unsupportedFiles = new Set<string>();

  for (const file of files) {
    const resolvedFile = path.resolve(file);
    if (!isSupportedFile(resolvedFile)) {
      unsupportedFiles.add(resolvedFile);
      continue;
    }

    const packageJsonPath = await findNearestPackageJson(resolvedFile);
    if (packageJsonPath === undefined) {
      unsupportedFiles.add(resolvedFile);
      continue;
    }

    const existingFiles = projectFiles.get(packageJsonPath);
    if (existingFiles === undefined) {
      projectFiles.set(packageJsonPath, [resolvedFile]);
      continue;
    }

    existingFiles.push(resolvedFile);
  }

  return {
    projects: [...projectFiles.entries()]
      .map(([packageJsonPath, selectedFiles]) => ({
        files: [...new Set(selectedFiles)].sort((left, right) => left.localeCompare(right)),
        packageJsonPath,
        projectRoot: path.dirname(packageJsonPath),
      }))
      .sort((left, right) => left.projectRoot.localeCompare(right.projectRoot)),
    unsupportedFiles: [...unsupportedFiles].sort((left, right) => left.localeCompare(right)),
  };
}

export async function resolveJavaScriptMetricsFiles(
  project: JavaScriptMetricsProject,
  runtime: JavaScriptRunnerRuntime,
): Promise<string[]> {
  const selectedSourceFiles = project.files.filter((file) =>
    javaScriptMetricsSourceExtensions.has(path.extname(file).toLowerCase()),
  );
  if (selectedSourceFiles.length > 0) {
    return [...new Set(selectedSourceFiles)].sort((left, right) => left.localeCompare(right));
  }

  return runtime.findMatchingFiles(
    project.projectRoot,
    (filePath) => javaScriptMetricsSourceExtensions.has(path.extname(filePath).toLowerCase()),
    runtime.shouldSkipProjectDirectory,
  );
}

function getProjectsForKind(
  graph: ProjectGraph,
  projectsById: ReadonlyMap<string, ProjectDescriptor>,
  file: string,
  kind: "javascript-package",
): JavaScriptPackageProjectDescriptor[] {
  const ids = graph.fileToProjectIds[path.resolve(file)] ?? [];

  return ids
    .map((id) => projectsById.get(id))
    .filter(
      (project): project is JavaScriptPackageProjectDescriptor =>
        project !== undefined && project.metadata.kind === kind,
    )
    .sort((left, right) => right.root.length - left.root.length);
}

function selectSingleKindProjects(
  graph: ProjectGraph,
  files: readonly string[],
  kind: "javascript-package",
): {
  projects: Array<JavaScriptPackageProjectDescriptor & { files: string[] }>;
  unsupportedFiles: string[];
} {
  const groupedFiles = new Map<string, string[]>();
  const unsupportedFiles = new Set<string>();
  const graphProjectsById = new Map(graph.projects.map((project) => [project.id, project]));
  const selectedProjectsById = new Map<string, JavaScriptPackageProjectDescriptor>();

  for (const file of files) {
    const project = getProjectsForKind(graph, graphProjectsById, file, kind)[0];
    if (project === undefined) {
      unsupportedFiles.add(file);
      continue;
    }

    const existingFiles = groupedFiles.get(project.id);
    if (existingFiles === undefined) {
      groupedFiles.set(project.id, [file]);
      selectedProjectsById.set(project.id, project);
      continue;
    }

    existingFiles.push(file);
  }

  return {
    projects: [...groupedFiles.entries()]
      .map(([projectId, selectedFiles]) => {
        const project = selectedProjectsById.get(projectId);
        if (project === undefined) {
          return undefined;
        }

        return {
          ...project,
          files: [...new Set(selectedFiles)].sort((left, right) => left.localeCompare(right)),
        };
      })
      .filter(
        (project): project is JavaScriptPackageProjectDescriptor & { files: string[] } =>
          project !== undefined,
      )
      .sort((left, right) => left.id.localeCompare(right.id)),
    unsupportedFiles: [...unsupportedFiles].sort((left, right) => left.localeCompare(right)),
  };
}

function readProjectName(projectRoot: string): string {
  const baseName = path.basename(projectRoot);
  return baseName.length > 0 ? baseName : projectRoot;
}
