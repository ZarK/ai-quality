import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Diagnostic } from "../contracts.js";

export function resolveDiagnosticFile(file: string | undefined, cwd: string): string | undefined {
  const trimmed = file?.trim();
  if (trimmed === undefined || trimmed.length === 0) {
    return undefined;
  }

  if (trimmed.startsWith("file://")) {
    return resolveDiagnosticFileUrl(trimmed);
  }

  if (looksLikeWindowsAbsolutePath(trimmed)) {
    return normalizeWindowsPath(trimmed);
  }

  if (looksLikeWindowsRelativePath(trimmed)) {
    return resolveWindowsRelativePath(trimmed, cwd);
  }

  return path.resolve(cwd, trimmed);
}

function resolveDiagnosticFileUrl(fileUrl: string): string | undefined {
  try {
    const url = new URL(fileUrl);
    if (url.protocol !== "file:") {
      return undefined;
    }

    const decodedPathname = decodeURIComponent(url.pathname);
    if (url.hostname.length > 0 && url.hostname.toLowerCase() !== "localhost") {
      return path.win32.normalize(`\\\\${url.hostname}${decodedPathname.replace(/\//gu, "\\")}`);
    }

    if (/^\/[A-Za-z]:/u.test(decodedPathname)) {
      return path.win32.normalize(decodedPathname.slice(1).replace(/\//gu, "\\"));
    }

    return path.normalize(fileURLToPath(url));
  } catch {
    return undefined;
  }
}

function looksLikeWindowsAbsolutePath(file: string): boolean {
  const normalized = stripWindowsNamespacePrefix(file);
  return (
    /^[A-Za-z]:[\\/]/u.test(normalized) ||
    /^\/[A-Za-z]:\//u.test(normalized) ||
    /^\\\\/u.test(normalized)
  );
}

function looksLikeWindowsRelativePath(file: string): boolean {
  const normalized = stripWindowsNamespacePrefix(file);
  return !looksLikeWindowsAbsolutePath(normalized) && normalized.includes("\\");
}

function normalizeWindowsPath(file: string): string {
  const normalized = stripWindowsNamespacePrefix(file);
  const withoutLeadingSlash = /^\/[A-Za-z]:\//u.test(normalized) ? normalized.slice(1) : normalized;
  return path.win32.normalize(withoutLeadingSlash.replace(/\//gu, "\\"));
}

function resolveWindowsRelativePath(file: string, cwd: string): string {
  return path.resolve(cwd, stripWindowsNamespacePrefix(file).replace(/[\\/]/gu, path.sep));
}

function stripWindowsNamespacePrefix(file: string): string {
  if (file.startsWith("\\\\?\\UNC\\")) {
    return `\\\\${file.slice("\\\\?\\UNC\\".length)}`;
  }

  return file.startsWith("\\\\?\\") ? file.slice(4) : file;
}
