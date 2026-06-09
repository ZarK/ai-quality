import { vi } from "vitest";
import {
  os,
  path,
  binaries,
  chmod,
  createDotNetFixtureProject,
  mkdir,
  mkdtemp,
  readdir,
  tempDirs,
  writeFile,
} from "./runners-test-environment.js";

export async function createDotNetCompetingSolutionProject(prefix: string): Promise<{
  noiseFile: string;
  root: string;
  solutionFile: string;
  sourceFile: string;
  testFile: string;
}> {
  const project = await createDotNetFixtureProject(prefix);
  const failingProjectDir = path.join(project.root, "other", "Failing.Tests");
  await mkdir(failingProjectDir, { recursive: true });

  await writeFile(
    path.join(failingProjectDir, "Failing.Tests.csproj"),
    [
      '<Project Sdk="Microsoft.NET.Sdk">',
      "  <PropertyGroup>",
      "    <TargetFramework>net10.0</TargetFramework>",
      "    <ImplicitUsings>enable</ImplicitUsings>",
      "    <Nullable>enable</Nullable>",
      "    <IsPackable>false</IsPackable>",
      "  </PropertyGroup>",
      "",
      "  <ItemGroup>",
      '    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.14.1" />',
      '    <PackageReference Include="xunit" Version="2.9.3" />',
      '    <PackageReference Include="xunit.runner.visualstudio" Version="3.1.4" />',
      "  </ItemGroup>",
      "",
      "  <ItemGroup>",
      '    <Using Include="Xunit" />',
      "  </ItemGroup>",
      "</Project>",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    path.join(failingProjectDir, "FailingTests.cs"),
    [
      "namespace Failing.Tests;",
      "",
      "public class FailingTests",
      "{",
      "    [Fact]",
      "    public void Always_fails()",
      "    {",
      "        Assert.True(false);",
      "    }",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    path.join(project.root, "AOther.slnx"),
    [
      "<Solution>",
      '  <Project Path="other/Failing.Tests/Failing.Tests.csproj" />',
      "</Solution>",
      "",
    ].join("\n"),
    "utf8",
  );

  const noiseDir = path.join(project.root, "unrelated");
  await mkdir(noiseDir, { recursive: true });
  const noiseFile = path.join(noiseDir, "Noise.cs");
  await writeFile(
    noiseFile,
    [
      "namespace Unrelated;",
      "",
      "public static class Noise",
      "{",
      "    public static string? Value => null;",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );

  const nestedProjectDir = path.join(project.root, "src", "DotNetFixture", "Nested", "Shadow");
  await mkdir(nestedProjectDir, { recursive: true });
  await writeFile(
    path.join(nestedProjectDir, "Shadow.csproj"),
    [
      '<Project Sdk="Microsoft.NET.Sdk">',
      "  <PropertyGroup>",
      "    <TargetFramework>net10.0</TargetFramework>",
      "    <ImplicitUsings>enable</ImplicitUsings>",
      "    <Nullable>enable</Nullable>",
      "  </PropertyGroup>",
      "</Project>",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    path.join(nestedProjectDir, "Shadow.cs"),
    [
      "namespace DotNetFixture.Nested;",
      "",
      "public static class Shadow",
      "{",
      '    public static string Describe() => "shadow";',
      "}",
      "",
    ].join("\n"),
    "utf8",
  );

  return {
    ...project,
    noiseFile,
  };
}

export async function collectJavaScriptAndTypeScriptFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(root, entry.name);
      if (entry.isDirectory()) {
        return collectJavaScriptAndTypeScriptFiles(entryPath);
      }

      if (!entry.isFile()) {
        return [];
      }

      return /\.(?:[cm]?js|[cm]?ts|jsx|tsx)$/u.test(entry.name) ? [entryPath] : [];
    }),
  );

  return files.flat();
}

export async function createCustomJavaScriptRunnerProject(options: {
  prefix: string;
  runner: "jest" | "vitest";
  runnerScript: string;
}): Promise<{
  packageJsonPath: string;
  root: string;
  sourceFile: string;
  tsconfigPath: string;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), options.prefix));
  tempDirs.push(root);

  const srcDir = path.join(root, "src");
  await mkdir(srcDir, { recursive: true });

  const packageJsonPath = path.join(root, "package.json");
  const tsconfigPath = path.join(root, "tsconfig.json");
  const sourceFile = path.join(srcDir, "index.ts");

  await writeFile(
    packageJsonPath,
    `${JSON.stringify({ name: options.prefix, private: true, scripts: { test: "node runner.cjs" } }, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(root, options.runner === "vitest" ? "vitest.config.ts" : "jest.config.js"),
    options.runner === "vitest" ? "export default {};\n" : "module.exports = {};\n",
    "utf8",
  );
  await writeFile(path.join(root, "runner.cjs"), options.runnerScript, "utf8");
  await writeFile(
    tsconfigPath,
    JSON.stringify(
      {
        compilerOptions: {
          module: "NodeNext",
          moduleResolution: "NodeNext",
          target: "ES2022",
        },
        include: ["src/**/*.ts"],
      },
      null,
      2,
    ),
    "utf8",
  );
  await writeFile(sourceFile, "export const value = 1;\n", "utf8");

  return {
    packageJsonPath,
    root,
    sourceFile,
    tsconfigPath,
  };
}

export async function createCustomJavaScriptE2eProject(options: {
  e2eScript?: string;
  packageJson?: Record<string, unknown>;
  prefix: string;
}): Promise<{
  packageJsonPath: string;
  root: string;
  sourceFile: string;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), options.prefix));
  tempDirs.push(root);

  const srcDir = path.join(root, "src");
  await mkdir(srcDir, { recursive: true });

  const packageJsonPath = path.join(root, "package.json");
  const sourceFile = path.join(srcDir, "index.ts");
  const packageJson = options.packageJson ?? {
    name: options.prefix,
    private: true,
    scripts:
      options.e2eScript === undefined
        ? {}
        : {
            "aiq:e2e": options.e2eScript,
          },
  };

  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
  await writeFile(sourceFile, "export const value = 1;\n", "utf8");

  return {
    packageJsonPath,
    root,
    sourceFile,
  };
}

export async function createCustomPythonRunnerProject(options: {
  prefix: string;
  runnerScript: string;
}): Promise<{
  root: string;
  shimDir: string;
  sourceFile: string;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), options.prefix));
  tempDirs.push(root);

  const sourceFile = path.join(root, "main.py");
  const shimDir = path.join(root, "bin");
  await mkdir(shimDir, { recursive: true });
  await writeFile(
    path.join(root, "pyproject.toml"),
    '[tool.pytest.ini_options]\npythonpath = ["."]\n',
    "utf8",
  );
  await writeFile(sourceFile, "def main() -> int:\n    return 1\n", "utf8");
  await writeFile(path.join(root, "python3.cjs"), options.runnerScript, "utf8");

  if (process.platform === "win32") {
    const shimPath = path.join(shimDir, "python.cmd");
    await writeFile(shimPath, '@echo off\r\n"%~dp0node.cmd" "%~dp0python.cjs" %*\r\n', "utf8");
    await writeFile(path.join(shimDir, "python.cjs"), options.runnerScript, "utf8");
    await writeFile(
      path.join(shimDir, "node.cmd"),
      `@echo off\r\n"${process.execPath}" %*\r\n`,
      "utf8",
    );
  } else {
    const shimPath = path.join(shimDir, "python3");
    await writeFile(shimPath, '#!/bin/sh\nexec node "$0.cjs" "$@"\n', "utf8");
    await chmod(shimPath, 0o755);
    await writeFile(`${shimPath}.cjs`, options.runnerScript, "utf8");
  }

  return {
    root,
    shimDir,
    sourceFile,
  };
}

export async function withPathedPythonShim<T>(shimDir: string, run: () => Promise<T>): Promise<T> {
  const previousPath = process.env.PATH ?? "";
  const pythonShimPath = path.join(
    shimDir,
    process.platform === "win32" ? "python.cmd" : "python3",
  );
  const resolverSpy = vi.spyOn(binaries, "resolvePythonCommand").mockReturnValue(pythonShimPath);
  process.env.PATH = `${shimDir}${path.delimiter}${previousPath}`;

  try {
    return await run();
  } finally {
    resolverSpy.mockRestore();
    process.env.PATH = previousPath;
  }
}
