import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { readJsonValue } from "../../src/languages/dotnet-metrics-tools.js";
import { readDotNetFileMetrics } from "../../src/languages/dotnet-source-metrics.js";

describe("dotnet source metrics", () => {
  it("counts constructor blocks alongside methods", async () => {
    const metrics = await readDotNetFileMetrics(`
public class Greeter
{
  public Greeter(string name) { }
  public string Greet() { return "hello"; }
}
`);

    expect(metrics.blockCount).toBe(2);
  });

  it("ignores decision tokens inside string and character literals", async () => {
    const metrics = await readDotNetFileMetrics(`
public class Greeter
{
  public string Greet()
  {
    return "if for foreach while case catch && || ? true : false" + '?';
  }
}
`);

    expect(metrics.maxComplexity.score).toBe(1);
  });

  it("throws when an existing JSON report is malformed", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "aiq-dotnet-json-"));
    try {
      const reportPath = path.join(tempDir, "report.json");
      await writeFile(reportPath, "{ not json", "utf8");

      await expect(readJsonValue(reportPath)).rejects.toThrow(SyntaxError);
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  });
});
