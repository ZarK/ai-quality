import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildProjectGraph,
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
} from "../src/graph.js";
import { normalizeFileManifest } from "../src/index.js";

export const fixtureBashRoot = path.resolve("test-projects/bash");
export const fixtureDotNetRoot = path.resolve("test-projects/dotnet");
export const fixtureGoRoot = path.resolve("test-projects/go");
export const fixtureJavaMavenRoot = path.resolve("test-projects/java-maven");
export const fixturePowerShellRoot = path.resolve("test-projects/powershell");
export const fixturePythonRoot = path.resolve("test-projects/python");
export const fixtureRustRoot = path.resolve("test-projects/rust");

export const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

export async function createTypeScriptWorkspace(): Promise<{
  packageJsonPath: string;
  root: string;
  sourceFile: string;
  tsconfigPath: string;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), "aiq-engine-graph-ts-"));
  tempDirs.push(root);

  const srcDir = path.join(root, "src");
  await mkdir(srcDir, { recursive: true });

  const packageJsonPath = path.join(root, "package.json");
  const tsconfigPath = path.join(root, "tsconfig.json");
  const vitestConfigPath = path.join(root, "vitest.config.ts");
  const sourceFile = path.join(srcDir, "index.ts");

  await writeFile(
    packageJsonPath,
    JSON.stringify(
      {
        name: "graph-fixture",
        private: true,
        scripts: {
          test: "vitest run",
        },
      },
      null,
      2,
    ),
  );
  await writeFile(
    tsconfigPath,
    JSON.stringify(
      {
        compilerOptions: {
          module: "NodeNext",
          moduleResolution: "NodeNext",
          target: "ES2022",
        },
        include: ["src/**/*.ts", "vitest.config.ts"],
      },
      null,
      2,
    ),
  );
  await writeFile(vitestConfigPath, "export default {};\n", "utf8");
  await writeFile(sourceFile, "export const answer = 42;\n", "utf8");

  return {
    packageJsonPath,
    root,
    sourceFile,
    tsconfigPath,
  };
}

export async function createDotNetWorkspace(): Promise<{
  projectFile: string;
  root: string;
  solutionFile: string;
  sourceFile: string;
}> {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "aiq-engine-graph-dotnet-"));
  tempDirs.push(workspaceRoot);

  const root = path.join(workspaceRoot, "project");
  await cp(fixtureDotNetRoot, root, { recursive: true });

  return {
    projectFile: path.join(root, "src", "DotNetFixture", "DotNetFixture.csproj"),
    root,
    solutionFile: path.join(root, "DotNetFixture.slnx"),
    sourceFile: path.join(root, "src", "DotNetFixture", "Greeter.cs"),
  };
}

export async function createJvmWorkspace(): Promise<{
  buildFile: string;
  root: string;
  sourceFile: string;
}> {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "aiq-engine-graph-jvm-"));
  tempDirs.push(workspaceRoot);

  const root = path.join(workspaceRoot, "project");
  await cp(fixtureJavaMavenRoot, root, { recursive: true });

  return {
    buildFile: path.join(root, "pom.xml"),
    root,
    sourceFile: path.join(root, "src", "main", "java", "dev", "aiq", "fixture", "Greeting.java"),
  };
}

export async function createHashicorpWorkspace(): Promise<{
  hclFile: string;
  root: string;
  terraformFile: string;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), "aiq-engine-graph-hashicorp-"));
  tempDirs.push(root);

  const terraformFile = path.join(root, "main.tf");
  const hclFile = path.join(root, "config.hcl");
  await mkdir(root, { recursive: true });
  await writeFile(terraformFile, 'terraform { required_version = ">= 1.0.0" }\n', "utf8");
  await writeFile(hclFile, 'container "web" { image = "nginx:latest" }\n', "utf8");

  return { hclFile, root, terraformFile };
}

export async function createGoWorkspace(): Promise<{
  moduleFile: string;
  root: string;
  sourceFile: string;
}> {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "aiq-engine-graph-go-"));
  tempDirs.push(workspaceRoot);

  const root = path.join(workspaceRoot, "project");
  await cp(fixtureGoRoot, root, { recursive: true });

  return {
    moduleFile: path.join(root, "go.mod"),
    root,
    sourceFile: path.join(root, "greeter.go"),
  };
}

export async function createRustWorkspace(): Promise<{
  manifestFile: string;
  root: string;
  sourceFile: string;
}> {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "aiq-engine-graph-rust-"));
  tempDirs.push(workspaceRoot);

  const root = path.join(workspaceRoot, "project");
  await cp(fixtureRustRoot, root, { recursive: true });

  return {
    manifestFile: path.join(root, "Cargo.toml"),
    root,
    sourceFile: path.join(root, "src", "lib.rs"),
  };
}

export async function createScriptWorkspace(
  fixtureRoot: string,
  prefix: string,
  sourceRelativePath: string,
): Promise<{ packageJsonFile: string; root: string; sourceFile: string }> {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(workspaceRoot);

  const root = path.join(workspaceRoot, "project");
  await cp(fixtureRoot, root, { recursive: true });

  return {
    packageJsonFile: path.join(root, "package.json"),
    root,
    sourceFile: path.join(root, sourceRelativePath),
  };
}

export {
  buildProjectGraph,
  cp,
  mkdir,
  mkdtemp,
  normalizeFileManifest,
  os,
  path,
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
  writeFile,
};
