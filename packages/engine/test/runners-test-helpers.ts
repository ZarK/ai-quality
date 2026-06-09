import { rm } from "node:fs/promises";

import { afterEach, vi } from "vitest";
import { tempDirs } from "./runners-test-environment.js";

export * from "./runners-test-environment.js";
export * from "./runners-test-projects.js";

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});
