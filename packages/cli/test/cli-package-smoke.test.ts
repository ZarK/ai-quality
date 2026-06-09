import { it } from "vitest";
import {
  createPackedPackageFixture,
  describePackageSmoke,
  ensurePackageSmokeBuild,
} from "./cli-package-smoke-fixture.js";
import {
  verifyBuiltPackageEntrypoints,
  verifyPackedCliCommands,
  verifyPackedCliImports,
  verifyPackedPackageFiles,
} from "./cli-package-smoke-helpers.js";
import { withExclusiveToolLock } from "./cli-test-helpers.js";

describePackageSmoke("CLI package smoke", () => {
  it("runs built and packed package entrypoints without runtime resolution errors", async () => {
    await withExclusiveToolLock("cli-package-smoke", async () => {
      await ensurePackageSmokeBuild();
      await verifyBuiltPackageEntrypoints();
      const packedFixture = await createPackedPackageFixture();
      await verifyPackedPackageFiles(packedFixture);
      await verifyPackedCliCommands(packedFixture);
      await verifyPackedCliImports(packedFixture);
    });
  }, 120_000);
});
