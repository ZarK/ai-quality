import { type AiqProfileName, aiqProfileNames } from "@tjalve/aiq/config";
import { type ManifestSource, type StageId, manifestSources, stageIds } from "@tjalve/aiq/model";

import { ServeRequestValidationError, type ServeRunRequestBody } from "./serve-types.js";

export function parseServeRunRequestBody(value: unknown): ServeRunRequestBody {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ServeRequestValidationError("Serve requests must be JSON objects.");
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.manifest !== "object" ||
    record.manifest === null ||
    Array.isArray(record.manifest)
  ) {
    throw new ServeRequestValidationError("Serve requests require a manifest object.");
  }

  const manifestRecord = record.manifest as Record<string, unknown>;
  if (!Array.isArray(manifestRecord.files) || manifestRecord.files.length === 0) {
    throw new ServeRequestValidationError(
      "Serve requests require manifest.files with at least one file.",
    );
  }

  const files = manifestRecord.files.map((file, index) => {
    if (typeof file !== "string" || file.trim().length === 0) {
      throw new ServeRequestValidationError(`manifest.files[${index}] must be a non-empty string.`);
    }

    return file;
  });

  const source =
    manifestRecord.source === undefined
      ? undefined
      : parseManifestSource(manifestRecord.source, "manifest.source");

  return {
    manifest: {
      files,
      ...(source === undefined ? {} : { source }),
    },
    ...(record.outDir === undefined
      ? {}
      : { outDir: parseOptionalString(record.outDir, "outDir") }),
    ...(record.stages === undefined ? {} : { stages: parseStringArray(record.stages, "stages") }),
    ...(record.profile === undefined
      ? {}
      : { profile: parseOptionalString(record.profile, "profile") }),
  };
}

function parseManifestSource(value: unknown, source: string): ManifestSource {
  if (typeof value !== "string" || !manifestSources.includes(value as ManifestSource)) {
    throw new ServeRequestValidationError(
      `${source} must be one of ${manifestSources.join(", ")}.`,
    );
  }

  return value as ManifestSource;
}

function parseOptionalString(value: unknown, source: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ServeRequestValidationError(`${source} must be a non-empty string.`);
  }

  return value;
}

function parseStringArray(value: unknown, source: string): string[] {
  if (!Array.isArray(value)) {
    throw new ServeRequestValidationError(`${source} must be an array.`);
  }

  return value.map((entry, index) => {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new ServeRequestValidationError(`${source}[${index}] must be a non-empty string.`);
    }

    return entry;
  });
}

export function parseStageList(value: string[], source: string): StageId[] {
  return value.map((stage) => {
    if (!stageIds.includes(stage as StageId)) {
      throw new ServeRequestValidationError(`Unsupported ${source} entry '${stage}'.`);
    }

    return stage as StageId;
  });
}

export function parseProfile(value: string, source: string): AiqProfileName {
  if (!aiqProfileNames.includes(value as AiqProfileName)) {
    throw new ServeRequestValidationError(
      `${source} must be one of ${aiqProfileNames.join(", ")}.`,
    );
  }

  return value as AiqProfileName;
}
