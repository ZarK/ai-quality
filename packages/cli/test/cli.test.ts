import { describe, expect, it } from "vitest";
import {
  path,
  access,
  adapterPackageWorkspaces,
  internalPackageWorkspaces,
  publishedPackageWorkspaces,
  readFile,
  repoRoot,
} from "./cli-test-helpers.js";

describe("CLI foundation", () => {
  it("keeps published package metadata aligned with the clean repository", async () => {
    for (const workspace of publishedPackageWorkspaces) {
      const packageJson = JSON.parse(
        await readFile(path.join(repoRoot, workspace, "package.json"), "utf8"),
      ) as {
        bin?: Record<string, string>;
        dependencies?: Record<string, string>;
        description?: string;
        files: string[];
        name: string;
        publishConfig: { access: string; provenance: boolean };
        repository: { directory: string; type: string; url: string };
        version: string;
      };

      expect(packageJson.name).toBe("@tjalve/aiq");
      expect(packageJson.description).toContain("remediation guidance");
      expect(packageJson.publishConfig).toEqual({ access: "public", provenance: true });
      expect(packageJson.repository).toEqual({
        directory: workspace,
        type: "git",
        url: "git+https://github.com/ZarK/ai-quality.git",
      });
      expect(packageJson.files).toContain("dist");
      expect(
        Object.values(packageJson.bin ?? {}).every((binPath) => !binPath.startsWith("./")),
      ).toBe(true);

      for (const [dependencyName, dependencyVersion] of Object.entries(
        packageJson.dependencies ?? {},
      )) {
        expect(dependencyName.startsWith("@tjalve/aiq-")).toBe(false);
        if (dependencyName === "@tjalve/aiq") {
          expect(dependencyVersion).toBe(packageJson.version);
        }
      }
    }

    const packageReadme = await readFile(path.join(repoRoot, "packages", "cli", "README.md"), {
      encoding: "utf8",
    });
    expect(packageReadme).toContain(
      "Metric stages enforce SLOC, complexity, maintainability, and readability defaults for source and test code.",
    );
    expect(packageReadme).toContain("AIQ uses repository-native tool configs by default.");
    expect(packageReadme).toContain("Existing Biome config, `tsconfig.json`, Vitest/Jest config");
    expect(packageReadme).toContain("Default text output is compact");
    expect(packageReadme).toContain("Use `--verbose` for run metadata");
    expect(packageReadme).toContain("Use `--format json` for the complete machine-readable report");
    expect(packageReadme).toContain("Before broad refactoring, make stage `0` e2e pass.");
    expect(packageReadme).toContain("direct purpose-revealing names");
  });

  it("keeps former split packages private to the workspace", async () => {
    for (const workspace of internalPackageWorkspaces) {
      const packageJson = JSON.parse(
        await readFile(path.join(repoRoot, workspace, "package.json"), "utf8"),
      ) as {
        dependencies?: Record<string, string>;
        name: string;
        private?: boolean;
        publishConfig?: unknown;
      };

      expect(packageJson.private).toBe(true);
      expect(packageJson.publishConfig).toBeUndefined();
      expect(packageJson.name.startsWith("@tjalve/aiq-")).toBe(false);

      for (const dependencyName of Object.keys(packageJson.dependencies ?? {})) {
        expect(dependencyName.startsWith("@tjalve/aiq-")).toBe(false);
      }
    }
  });

  it("keeps adapter packages on the canonical aiq package surface", async () => {
    for (const workspace of adapterPackageWorkspaces) {
      const packageJson = JSON.parse(
        await readFile(path.join(repoRoot, workspace, "package.json"), "utf8"),
      ) as { dependencies?: Record<string, string>; version: string };
      const aiqDependencies = Object.keys(packageJson.dependencies ?? {}).filter((dependency) =>
        dependency.startsWith("@tjalve/aiq"),
      );

      expect(packageJson.dependencies?.["@tjalve/aiq"]).toBe(packageJson.version);
      expect(aiqDependencies).toEqual(["@tjalve/aiq"]);
    }
  });

  it("restores the published quality bin alias", async () => {
    const packageJson = JSON.parse(
      await readFile(path.join(repoRoot, "packages", "cli", "package.json"), "utf8"),
    ) as { bin?: Record<string, string>; exports?: Record<string, unknown> };

    expect(packageJson.bin).toMatchObject({
      aiq: "dist/bin/aiq.js",
      quality: "dist/bin/aiq.js",
    });
    expect(Object.keys(packageJson.exports ?? {}).sort()).toEqual([
      ".",
      "./api",
      "./benchmark",
      "./config",
      "./engine",
      "./model",
      "./reporters",
      "./schema",
    ]);
  });
});
