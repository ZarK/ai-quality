import path from "node:path";

import { javaScriptMetricsSourceExtensions } from "../utils/node-utils.js";

export function filterJavaScriptMetricsFiles(files: readonly string[]): string[] {
  return files.filter((file) => isJavaScriptMetricsTaskFile(file));
}

export function filterJavaScriptTestFiles(files: readonly string[]): string[] {
  return files.filter((file) => isJavaScriptTestTaskFile(file));
}

export function isJavaScriptMetricsTaskFile(file: string): boolean {
  return (
    javaScriptMetricsSourceExtensions.has(path.extname(file).toLowerCase()) ||
    path.basename(file).toLowerCase() === "package.json"
  );
}

export function isJavaScriptTestTaskFile(file: string): boolean {
  return (
    javaScriptMetricsSourceExtensions.has(path.extname(file).toLowerCase()) ||
    path.basename(file).toLowerCase() === "package.json"
  );
}
