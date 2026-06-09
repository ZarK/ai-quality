export function readOptionalCode(value: string | undefined): string | undefined {
  return value === undefined || value.length === 0 ? undefined : value;
}

export function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

export function readStringArray(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

export function readNestedString(
  record: Record<string, unknown>,
  keys: string[],
): string | undefined {
  const value = readNestedValue(record, keys);
  return typeof value === "string" ? value : undefined;
}

export function readNestedRecord(
  record: Record<string, unknown>,
  keys: string[],
): Record<string, unknown> | undefined {
  const value = readNestedValue(record, keys);
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

export function readNestedValue(record: Record<string, unknown>, keys: string[]): unknown {
  let current: unknown = record;

  for (const key of keys) {
    if (typeof current !== "object" || current === null || !(key in current)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

export function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function readIntegerString(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function readRecordArray(value: unknown, key: string): Array<Record<string, unknown>> {
  if (typeof value !== "object" || value === null) {
    return [];
  }

  return readRecordArrayFromValue((value as Record<string, unknown>)[key]);
}

export function readRecordArrayFromValue(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
  );
}
