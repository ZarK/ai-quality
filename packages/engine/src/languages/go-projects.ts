import { access } from "node:fs/promises";
import path from "node:path";

import type { ProjectDescriptor, ProjectGraph, ProjectMetadata } from "../contracts.js";
import { findNearestConfig } from "../utils/path-utils.js";

type GoProjectDescriptor = ProjectDescriptor & {
  metadata: ProjectMetadata & {
    kind: "go";
    moduleFilePath: string;
  };
};

export type GoProject = {
  files: string[];
  moduleFilePath: string;
  projectRoot: string;
};

export const goSourceExtensions = new Set([".go"]);
export const goProjectConfigNames = ["go.mod", "go.sum"];

export async function discoverGoProjects(file: string): Promise<ProjectDescriptor[]> {
  const project = await createGoProject(file);
  return project === undefined ? [] : [project];
}

export function selectGoProjects(
  graph: ProjectGraph,
  files: readonly string[],
): { projects: GoProject[]; unsupportedFiles: string[] } {
  const grouped = selectSingleKindProjects(graph, files, "go");

  return {
    projects: grouped.projects.map((project) => ({
      files: project.files,
      moduleFilePath: project.metadata.moduleFilePath,
      projectRoot: project.root,
    })),
    unsupportedFiles: grouped.unsupportedFiles,
  };
}

export function isGoTaskFile(file: string): boolean {
  const extension = path.extname(file).toLowerCase();
  if (goSourceExtensions.has(extension)) {
    return true;
  }

  const baseName = path.basename(file).toLowerCase();
  return goProjectConfigNames.includes(baseName);
}

async function createGoProject(file: string): Promise<GoProjectDescriptor | undefined> {
  const resolvedFile = path.resolve(file);
  if (!isGoTaskFile(resolvedFile)) {
    return undefined;
  }

  const moduleFilePath =
    path.basename(resolvedFile).toLowerCase() === "go.mod"
      ? resolvedFile
      : await findNearestConfig(resolvedFile, "go.mod");
  if (moduleFilePath === undefined) {
    return undefined;
  }

  return {
    ecosystem: "go",
    id: `go:${moduleFilePath}`,
    language: "go",
    manifestFiles: [moduleFilePath],
    metadata: {
      kind: "go",
      moduleFilePath,
    },
    name: readProjectName(path.dirname(moduleFilePath)),
    root: path.dirname(moduleFilePath),
    sourceFiles: [resolvedFile],
  };
}

function getProjectsForKind(graph: ProjectGraph, file: string, kind: "go"): GoProjectDescriptor[] {
  const ids = graph.fileToProjectIds[path.resolve(file)] ?? [];
  const projectsById = new Map(graph.projects.map((project) => [project.id, project]));

  return ids
    .map((id) => projectsById.get(id))
    .filter(
      (project): project is GoProjectDescriptor =>
        project !== undefined && project.metadata.kind === kind,
    );
}

function selectSingleKindProjects(
  graph: ProjectGraph,
  files: readonly string[],
  kind: "go",
): { projects: Array<GoProjectDescriptor & { files: string[] }>; unsupportedFiles: string[] } {
  const groupedFiles = new Map<string, string[]>();
  const unsupportedFiles = new Set<string>();
  const selectedProjectsById = new Map<string, GoProjectDescriptor>();

  for (const file of files) {
    const project = getProjectsForKind(graph, file, kind)[0];
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
        (project): project is GoProjectDescriptor & { files: string[] } => project !== undefined,
      )
      .sort((left, right) => left.id.localeCompare(right.id)),
    unsupportedFiles: [...unsupportedFiles].sort((left, right) => left.localeCompare(right)),
  };
}

function readProjectName(projectRoot: string): string {
  const baseName = path.basename(projectRoot);
  return baseName.length > 0 ? baseName : projectRoot;
}

export async function resolveGoProjects(
  graph: ProjectGraph | undefined,
  files: readonly string[],
): Promise<{ projects: GoProject[]; unsupportedFiles: string[] }> {
  if (graph !== undefined) {
    return selectGoProjects(graph, files);
  }

  const projectFiles = new Map<string, string[]>();
  const projectRoots = new Map<string, string>();
  const unsupportedFiles = new Set<string>();

  for (const file of files) {
    const project = await findNearestGoProject(file);
    if (project === undefined) {
      unsupportedFiles.add(file);
      continue;
    }

    const existingFiles = projectFiles.get(project.moduleFilePath);
    if (existingFiles === undefined) {
      projectFiles.set(project.moduleFilePath, [file]);
      projectRoots.set(project.moduleFilePath, project.projectRoot);
      continue;
    }

    existingFiles.push(file);
  }

  return {
    projects: [...projectFiles.entries()]
      .map(([moduleFilePath, selectedFiles]) => ({
        files: [...new Set(selectedFiles)].sort((left, right) => left.localeCompare(right)),
        moduleFilePath,
        projectRoot: projectRoots.get(moduleFilePath) ?? path.dirname(moduleFilePath),
      }))
      .sort((left, right) => left.moduleFilePath.localeCompare(right.moduleFilePath)),
    unsupportedFiles: [...unsupportedFiles].sort((left, right) => left.localeCompare(right)),
  };
}

async function findNearestGoProject(filePath: string): Promise<GoProject | undefined> {
  const resolvedPath = path.resolve(filePath);
  const baseName = path.basename(resolvedPath).toLowerCase();
  if (baseName === "go.mod") {
    return {
      files: [resolvedPath],
      moduleFilePath: resolvedPath,
      projectRoot: path.dirname(resolvedPath),
    };
  }

  if (!isGoTaskFile(resolvedPath)) {
    return undefined;
  }

  const moduleFilePath = await findNearestConfig(resolvedPath, "go.mod");
  if (moduleFilePath === undefined) {
    return undefined;
  }

  return {
    files: [resolvedPath],
    moduleFilePath,
    projectRoot: path.dirname(moduleFilePath),
  };
}

export function filterGoFiles(files: readonly string[]): string[] {
  return files.filter((file) => isGoTaskFile(file));
}

export async function findFileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
