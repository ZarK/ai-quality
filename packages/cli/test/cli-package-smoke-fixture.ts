import { describe, expect } from "vitest";
import {
  os,
  path,
  access,
  mkdir,
  mkdtemp,
  repoRoot,
  runNpmCommand,
  tempArtifacts,
  withExclusiveToolLock,
  writeFile,
} from "./cli-test-helpers.js";

const packageSmokeWorkspaces = ["packages/cli"] as const;
const approvedPackageSmokeDependencies = [
  {
    name: "@tjalve/qube-cli",
    packageRoot: path.join(repoRoot, "packages", "cli", "node_modules", "@tjalve", "qube-cli"),
    version: "0.1.1",
  },
] as const;

const describePackageSmoke = process.env.AIQ_SMOKE === "1" ? describe : describe.skip;

let packageSmokeBuildPromise: Promise<void> | undefined;

interface PackedWorkspacePackage {
  files: Array<{ path: string }>;
  tarballPath: string;
  workspace: (typeof packageSmokeWorkspaces)[number];
}

interface PackedPackageFixture {
  fixtureFilePath: string;
  packages: PackedWorkspacePackage[];
  root: string;
}

async function ensurePackageSmokeBuild(): Promise<void> {
  packageSmokeBuildPromise ??= withExclusiveToolLock("cli-package-smoke-build", async () => {
    const buildResult = await runNpmCommand(
      [
        "run",
        "build",
        ...packageSmokeWorkspaces.flatMap((workspace) => ["--workspace", workspace]),
      ],
      { cwd: repoRoot },
    );
    expect(buildResult.exitCode).toBe(0);
  });

  await packageSmokeBuildPromise;
}

async function packWorkspacePackage(
  workspace: (typeof packageSmokeWorkspaces)[number],
): Promise<PackedWorkspacePackage> {
  const packResult = await runNpmCommand(["pack", "--json", "--workspace", workspace], {
    cwd: repoRoot,
  });

  expect(packResult.exitCode).toBe(0);
  const [packMetadata] = JSON.parse(packResult.stdout) as Array<{
    filename: string;
    files: Array<{ path: string }>;
  }>;
  expect(packMetadata).toBeDefined();

  const tarballPath = path.join(repoRoot, packMetadata.filename);
  tempArtifacts.push(tarballPath);
  return {
    files: packMetadata.files,
    tarballPath,
    workspace,
  };
}

async function packApprovedPackageSmokeDependency(
  dependency: (typeof approvedPackageSmokeDependencies)[number],
  destination: string,
): Promise<string> {
  await access(dependency.packageRoot);
  const packResult = await runNpmCommand(
    [
      "pack",
      "--json",
      "--ignore-scripts",
      "--pack-destination",
      destination,
      dependency.packageRoot,
    ],
    {
      cwd: repoRoot,
    },
  );

  expect(packResult.exitCode, packResult.stderr || packResult.stdout).toBe(0);
  const [packMetadata] = JSON.parse(packResult.stdout) as Array<{
    filename: string;
    name: string;
    version: string;
  }>;
  expect(packMetadata).toMatchObject({
    name: dependency.name,
    version: dependency.version,
  });

  return path.join(destination, packMetadata.filename);
}

async function createPackedPackageFixture(): Promise<PackedPackageFixture> {
  const root = await mkdtemp(path.join(os.tmpdir(), "aiq-cli-package-smoke-"));
  tempArtifacts.push(root);

  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(
    path.join(root, "package.json"),
    `${JSON.stringify({ name: "aiq-cli-package-smoke", private: true }, null, 2)}\n`,
    "utf8",
  );

  const fixtureFilePath = path.join(root, "src", "index.ts");
  await writeFile(fixtureFilePath, "export const value = 1;\n", "utf8");

  const [packages, approvedDependencies] = await Promise.all([
    Promise.all(packageSmokeWorkspaces.map(packWorkspacePackage)),
    Promise.all(
      approvedPackageSmokeDependencies.map((dependency) =>
        packApprovedPackageSmokeDependency(dependency, root),
      ),
    ),
  ]);

  const installResult = await runNpmCommand(
    [
      "install",
      "--ignore-scripts",
      "--no-package-lock",
      ...packages.map((entry) => entry.tarballPath),
      ...approvedDependencies,
    ],
    {
      cwd: root,
    },
  );
  expect(installResult.exitCode, installResult.stderr || installResult.stdout).toBe(0);

  return { fixtureFilePath, packages, root };
}

export { createPackedPackageFixture, describePackageSmoke, ensurePackageSmokeBuild };
export type { PackedPackageFixture };
