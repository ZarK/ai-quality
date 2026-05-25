import { access } from "node:fs/promises";
import path from "node:path";

import type { FileManifest, FileManifestInput } from "./contracts.js";

export async function normalizeFileManifest(
  input: FileManifestInput,
  cwd = process.cwd(),
): Promise<FileManifest> {
  const unique = new Set<string>();

  for (const file of input.files) {
    const trimmed = file.trim();
    if (trimmed.length === 0) {
      continue;
    }

    const resolved = path.resolve(cwd, trimmed);
    await access(resolved);
    unique.add(resolved);
  }

  const files = [...unique].sort();
  if (files.length === 0) {
    throw new Error("No input files were provided.");
  }

  return {
    entries: files.map((file) => ({
      extension: path.extname(file),
      path: file,
    })),
    files,
    root: cwd,
    source: input.source,
    summary: {
      fileCount: files.length,
    },
  };
}
