import type {
  BenchmarkScenario,
  BenchmarkScenarioKind,
  RunBenchmarkSuiteOptions,
} from "./types.js";

export function filterBenchmarkScenarios(
  scenarios: readonly BenchmarkScenario[],
  options: Pick<RunBenchmarkSuiteOptions, "kinds" | "scenarioIds" | "tags"> = {},
): BenchmarkScenario[] {
  const requestedScenarioIds = normalizeStrings(options.scenarioIds);
  const requestedTags = normalizeStrings(options.tags);
  const requestedKinds = normalizeKinds(options.kinds);

  if (requestedScenarioIds.length > 0) {
    const knownScenarioIds = new Set(scenarios.map((scenario) => scenario.id));
    const missingScenarioIds = requestedScenarioIds.filter((id) => !knownScenarioIds.has(id));
    if (missingScenarioIds.length > 0) {
      throw new Error(
        `Unknown benchmark scenario id${missingScenarioIds.length === 1 ? "" : "s"}: ${missingScenarioIds.join(", ")}.`,
      );
    }
  }

  const filtered = scenarios.filter((scenario) => {
    if (requestedScenarioIds.length > 0 && !requestedScenarioIds.includes(scenario.id)) {
      return false;
    }

    if (requestedKinds.length > 0 && !requestedKinds.includes(scenario.kind)) {
      return false;
    }

    if (
      requestedTags.length > 0 &&
      !requestedTags.every((tag) => scenario.metadata.tags.includes(tag))
    ) {
      return false;
    }

    return true;
  });

  if (filtered.length === 0) {
    throw new Error("No benchmark scenarios matched the requested filters.");
  }

  return filtered;
}

export function normalizeStrings(values: readonly string[] | undefined): string[] {
  return [
    ...new Set((values ?? []).map((value) => value.trim()).filter((value) => value.length > 0)),
  ].sort((left, right) => left.localeCompare(right));
}

export function normalizeKinds(
  values: readonly BenchmarkScenarioKind[] | undefined,
): BenchmarkScenarioKind[] {
  return [...new Set(values ?? [])].sort((left, right) => left.localeCompare(right));
}
