import path from "node:path";

import type { ProjectDescriptor, ProjectGraph, ProjectMetadata } from "../contracts.js";
import { findNearestConfig, pathExists } from "../utils/path-utils.js";

type RustProjectDescriptor = ProjectDescriptor & {
  metadata: ProjectMetadata & {
    kind: "rust";
    manifestPath: string;
  };
};

export type RustProject = {
  files: string[];
  manifestPath: string;
  projectRoot: string;
};

export const rustSourceExtensions = new Set([".rs"]);
export const rustProjectConfigNames = ["Cargo.toml", "Cargo.lock"];

export async function discoverRustProjects(file: string): Promise<ProjectDescriptor[]> {
  const project = await createRustProject(file);
  return project === undefined ? [] : [project];
}

export function selectRustProjects(
  graph: ProjectGraph,
  files: readonly string[],
): { projects: RustProject[]; unsupportedFiles: string[] } {
  const grouped = selectSingleKindProjects(graph, files, "rust");

  return {
    projects: grouped.projects.map((project) => ({
      files: project.files,
      manifestPath: project.metadata.manifestPath,
      projectRoot: project.root,
    })),
    unsupportedFiles: grouped.unsupportedFiles,
  };
}

export function isRustTaskFile(file: string): boolean {
  const extension = path.extname(file).toLowerCase();
  if (rustSourceExtensions.has(extension)) {
    return true;
  }

  const baseName = path.basename(file);
  return rustProjectConfigNames.includes(baseName);
}

async function createRustProject(file: string): Promise<RustProjectDescriptor | undefined> {
  const resolvedFile = path.resolve(file);
  if (!isRustTaskFile(resolvedFile)) {
    return undefined;
  }

  let manifestPath: string | undefined;
  const baseName = path.basename(resolvedFile);
  if (baseName === "Cargo.toml") {
    manifestPath = resolvedFile;
  } else if (baseName === "Cargo.lock") {
    const candidate = path.join(path.dirname(resolvedFile), "Cargo.toml");
    if (await pathExists(candidate)) {
      manifestPath = candidate;
    }
  } else {
    manifestPath = await findNearestConfig(resolvedFile, "Cargo.toml");
  }

  if (manifestPath === undefined) {
    return undefined;
  }

  return {
    ecosystem: "rust",
    id: `rust:${manifestPath}`,
    language: "rust",
    manifestFiles: [manifestPath],
    metadata: {
      kind: "rust",
      manifestPath,
    },
    name: readProjectName(path.dirname(manifestPath)),
    root: path.dirname(manifestPath),
    sourceFiles: [resolvedFile],
  };
}

function getProjectsForKind(
  graph: ProjectGraph,
  file: string,
  kind: "rust",
): RustProjectDescriptor[] {
  const ids = graph.fileToProjectIds[path.resolve(file)] ?? [];
  const projectsById = new Map(graph.projects.map((project) => [project.id, project]));

  return ids
    .map((id) => projectsById.get(id))
    .filter(
      (project): project is RustProjectDescriptor =>
        project !== undefined && project.metadata.kind === kind,
    );
}

function selectSingleKindProjects(
  graph: ProjectGraph,
  files: readonly string[],
  kind: "rust",
): { projects: Array<RustProjectDescriptor & { files: string[] }>; unsupportedFiles: string[] } {
  const groupedFiles = new Map<string, string[]>();
  const unsupportedFiles = new Set<string>();
  const selectedProjectsById = new Map<string, RustProjectDescriptor>();

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
        (project): project is RustProjectDescriptor & { files: string[] } => project !== undefined,
      )
      .sort((left, right) => left.id.localeCompare(right.id)),
    unsupportedFiles: [...unsupportedFiles].sort((left, right) => left.localeCompare(right)),
  };
}

function readProjectName(projectRoot: string): string {
  const baseName = path.basename(projectRoot);
  return baseName.length > 0 ? baseName : projectRoot;
}

export async function resolveRustProjects(
  graph: ProjectGraph | undefined,
  files: readonly string[],
): Promise<{ projects: RustProject[]; unsupportedFiles: string[] }> {
  if (graph !== undefined) {
    return selectRustProjects(graph, files);
  }

  const projectFiles = new Map<string, string[]>();
  const projectRoots = new Map<string, string>();
  const unsupportedFiles = new Set<string>();

  for (const file of files) {
    const project = await findNearestRustProject(file);
    if (project === undefined) {
      unsupportedFiles.add(file);
      continue;
    }

    const existingFiles = projectFiles.get(project.manifestPath);
    if (existingFiles === undefined) {
      projectFiles.set(project.manifestPath, [file]);
      projectRoots.set(project.manifestPath, project.projectRoot);
      continue;
    }

    existingFiles.push(file);
  }

  return {
    projects: [...projectFiles.entries()]
      .map(([manifestPath, selectedFiles]) => ({
        files: [...new Set(selectedFiles)].sort((left, right) => left.localeCompare(right)),
        manifestPath,
        projectRoot: projectRoots.get(manifestPath) ?? path.dirname(manifestPath),
      }))
      .sort((left, right) => left.manifestPath.localeCompare(right.manifestPath)),
    unsupportedFiles: [...unsupportedFiles].sort((left, right) => left.localeCompare(right)),
  };
}

async function findNearestRustProject(filePath: string): Promise<RustProject | undefined> {
  const resolvedPath = path.resolve(filePath);
  const baseName = path.basename(resolvedPath);
  if (baseName === "Cargo.toml") {
    return {
      files: [resolvedPath],
      manifestPath: resolvedPath,
      projectRoot: path.dirname(resolvedPath),
    };
  }

  if (baseName === "Cargo.lock") {
    const manifestPath = path.join(path.dirname(resolvedPath), "Cargo.toml");
    if (!(await pathExists(manifestPath))) {
      return undefined;
    }

    return {
      files: [resolvedPath],
      manifestPath,
      projectRoot: path.dirname(manifestPath),
    };
  }

  if (!isRustTaskFile(resolvedPath)) {
    return undefined;
  }

  const manifestPath = await findNearestConfig(resolvedPath, "Cargo.toml");
  if (manifestPath === undefined) {
    return undefined;
  }

  return {
    files: [resolvedPath],
    manifestPath,
    projectRoot: path.dirname(manifestPath),
  };
}

export function filterRustFiles(files: readonly string[]): string[] {
  return files.filter((file) => isRustTaskFile(file));
}
