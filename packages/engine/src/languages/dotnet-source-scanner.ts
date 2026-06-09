type DotNetScannerState = {
  index: number;
  inBlockComment: boolean;
  inChar: boolean;
  inString: boolean;
  inVerbatimString: boolean;
  result: string;
};

type DotNetLiteralScanState = Omit<DotNetScannerState, "inBlockComment" | "result">;

type DotNetBranchDepth = {
  braceDepth: number;
  bracketDepth: number;
  parenDepth: number;
};

export function stripDotNetComments(source: string): string {
  const state: DotNetScannerState = {
    inBlockComment: false,
    inChar: false,
    inString: false,
    inVerbatimString: false,
    index: 0,
    result: "",
  };

  while (state.index < source.length) {
    if (consumeDotNetCommentOrLiteral(source, state)) {
      continue;
    }

    state.result += source[state.index] ?? "";
    state.index += 1;
  }

  return state.result;
}

export function countDotNetTernaryOperators(source: string): number {
  let count = 0;
  const state: DotNetLiteralScanState = {
    inChar: false,
    inString: false,
    inVerbatimString: false,
    index: 0,
  };

  while (state.index < source.length) {
    if (advanceDotNetLiteralScan(source, state)) {
      continue;
    }

    if (isDotNetTernaryQuestionMark(source, state.index)) {
      count += 1;
    }
    state.index += 1;
  }

  return count;
}

export function hasDotNetTernaryBranch(source: string, questionMarkIndex: number): boolean {
  const state: DotNetLiteralScanState = {
    inChar: false,
    inString: false,
    inVerbatimString: false,
    index: questionMarkIndex + 1,
  };
  const depth: DotNetBranchDepth = {
    braceDepth: 0,
    bracketDepth: 0,
    parenDepth: 0,
  };

  while (state.index < source.length) {
    if (advanceDotNetLiteralScan(source, state)) {
      continue;
    }

    const branchResult = readDotNetBranchToken(source[state.index], depth);
    if (branchResult !== undefined) {
      return branchResult;
    }
    state.index += 1;
  }

  return false;
}

function consumeDotNetCommentOrLiteral(source: string, state: DotNetScannerState): boolean {
  return (
    consumeDotNetBlockComment(source, state) ||
    consumeDotNetString(source, state) ||
    consumeDotNetVerbatimString(source, state) ||
    consumeDotNetChar(source, state) ||
    startDotNetCommentOrLiteral(source, state)
  );
}

function consumeDotNetBlockComment(source: string, state: DotNetScannerState): boolean {
  if (!state.inBlockComment) {
    return false;
  }

  const current = source[state.index];
  const next = source[state.index + 1];
  if (current === "*" && next === "/") {
    state.inBlockComment = false;
    state.index += 2;
    return true;
  }
  if (current === "\n") {
    state.result += "\n";
  }
  state.index += 1;
  return true;
}

function consumeDotNetString(source: string, state: DotNetScannerState): boolean {
  if (!state.inString) {
    return false;
  }

  const current = source[state.index];
  state.result += current ?? "";
  if (current === "\\") {
    state.result += source[state.index + 1] ?? "";
    state.index += 2;
    return true;
  }
  if (current === '"') {
    state.inString = false;
  }
  state.index += 1;
  return true;
}

function consumeDotNetVerbatimString(source: string, state: DotNetScannerState): boolean {
  if (!state.inVerbatimString) {
    return false;
  }

  const current = source[state.index];
  const next = source[state.index + 1];
  state.result += current ?? "";
  if (current === '"' && next === '"') {
    state.result += next;
    state.index += 2;
    return true;
  }
  if (current === '"') {
    state.inVerbatimString = false;
  }
  state.index += 1;
  return true;
}

function consumeDotNetChar(source: string, state: DotNetScannerState): boolean {
  if (!state.inChar) {
    return false;
  }

  const current = source[state.index];
  state.result += current ?? "";
  if (current === "\\") {
    state.result += source[state.index + 1] ?? "";
    state.index += 2;
    return true;
  }
  if (current === "'") {
    state.inChar = false;
  }
  state.index += 1;
  return true;
}

function startDotNetCommentOrLiteral(source: string, state: DotNetScannerState): boolean {
  const current = source[state.index];
  const next = source[state.index + 1];
  if (current === "/" && next === "*") {
    state.inBlockComment = true;
    state.index += 2;
    return true;
  }
  if (current === "/" && next === "/") {
    skipDotNetLineComment(source, state);
    return true;
  }
  return startDotNetLiteral(source, state);
}

function startDotNetLiteral(source: string, state: DotNetScannerState): boolean {
  const current = source[state.index];
  const next = source[state.index + 1];
  if (current === "@" && next === '"') {
    state.result += '@"';
    state.inVerbatimString = true;
    state.index += 2;
    return true;
  }
  if (current === '"') {
    state.result += current;
    state.inString = true;
    state.index += 1;
    return true;
  }
  if (current === "'") {
    state.result += current;
    state.inChar = true;
    state.index += 1;
    return true;
  }
  return false;
}

function skipDotNetLineComment(source: string, state: DotNetScannerState): void {
  while (state.index < source.length && source[state.index] !== "\n") {
    state.index += 1;
  }
}

function advanceDotNetLiteralScan(source: string, state: DotNetLiteralScanState): boolean {
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

function isDotNetTernaryQuestionMark(source: string, index: number): boolean {
  const current = source[index];
  const next = source[index + 1];
  return (
    current === "?" &&
    next !== "?" &&
    next !== "." &&
    next !== "[" &&
    hasDotNetTernaryBranch(source, index)
  );
}

function readDotNetBranchToken(
  current: string | undefined,
  depth: DotNetBranchDepth,
): boolean | undefined {
  const depthResult = updateDotNetBranchDepth(current, depth);
  if (depthResult === "unmatched-close") {
    return false;
  }
  if (depthResult === "updated") {
    return undefined;
  }
  if (current === ":" && isAtDotNetBranchRoot(depth)) {
    return true;
  }
  if ((current === ";" || current === ",") && isAtDotNetBranchRoot(depth)) {
    return false;
  }
  return undefined;
}

function updateDotNetBranchDepth(
  current: string | undefined,
  depth: DotNetBranchDepth,
): "unmatched-close" | "updated" | undefined {
  switch (current) {
    case "(":
      depth.parenDepth += 1;
      return "updated";
    case ")":
      if (depth.parenDepth === 0) {
        return "unmatched-close";
      }
      depth.parenDepth -= 1;
      return "updated";
    case "[":
      depth.bracketDepth += 1;
      return "updated";
    case "]":
      if (depth.bracketDepth === 0) {
        return "unmatched-close";
      }
      depth.bracketDepth -= 1;
      return "updated";
    case "{":
      depth.braceDepth += 1;
      return "updated";
    case "}":
      if (depth.braceDepth === 0) {
        return "unmatched-close";
      }
      depth.braceDepth -= 1;
      return "updated";
    default:
      return undefined;
  }
}

function isAtDotNetBranchRoot(depth: DotNetBranchDepth): boolean {
  return depth.parenDepth === 0 && depth.bracketDepth === 0 && depth.braceDepth === 0;
}
