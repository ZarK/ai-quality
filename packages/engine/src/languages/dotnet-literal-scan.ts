export type DotNetLiteralScanState = {
  index: number;
  inChar: boolean;
  inString: boolean;
  inVerbatimString: boolean;
};

export function advanceDotNetLiteralScan(source: string, state: DotNetLiteralScanState): boolean {
  return (
    advanceDotNetStringScan(source, state) ||
    advanceDotNetVerbatimStringScan(source, state) ||
    advanceDotNetCharScan(source, state) ||
    startDotNetLiteralScan(source, state)
  );
}

function advanceDotNetStringScan(source: string, state: DotNetLiteralScanState): boolean {
  if (!state.inString) {
    return false;
  }

  const current = source[state.index];
  if (current === "\\") {
    state.index += 2;
    return true;
  }
  if (current === '"') {
    state.inString = false;
  }
  state.index += 1;
  return true;
}

function advanceDotNetVerbatimStringScan(source: string, state: DotNetLiteralScanState): boolean {
  if (!state.inVerbatimString) {
    return false;
  }

  const current = source[state.index];
  const next = source[state.index + 1];
  if (current === '"' && next === '"') {
    state.index += 2;
    return true;
  }
  if (current === '"') {
    state.inVerbatimString = false;
  }
  state.index += 1;
  return true;
}

function advanceDotNetCharScan(source: string, state: DotNetLiteralScanState): boolean {
  if (!state.inChar) {
    return false;
  }

  const current = source[state.index];
  if (current === "\\") {
    state.index += 2;
    return true;
  }
  if (current === "'") {
    state.inChar = false;
  }
  state.index += 1;
  return true;
}

function startDotNetLiteralScan(source: string, state: DotNetLiteralScanState): boolean {
  const current = source[state.index];
  const next = source[state.index + 1];
  if (current === "@" && next === '"') {
    state.inVerbatimString = true;
    state.index += 2;
    return true;
  }
  if (current === '"') {
    state.inString = true;
    state.index += 1;
    return true;
  }
  if (current === "'") {
    state.inChar = true;
    state.index += 1;
    return true;
  }
  return false;
}
