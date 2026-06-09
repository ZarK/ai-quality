export function parseGoVetJsonValues(candidate: string): unknown[] {
  try {
    return [JSON.parse(candidate)];
  } catch {
    const documents = splitConcatenatedJsonDocuments(candidate).flatMap((document) => {
      try {
        return [JSON.parse(document)];
      } catch {
        return [];
      }
    });
    if (documents.length > 0) {
      return documents;
    }

    return candidate
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .flatMap((line) => {
        try {
          return [JSON.parse(line)];
        } catch {
          return [];
        }
      });
  }
}

function splitConcatenatedJsonDocuments(candidate: string): string[] {
  const documents: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < candidate.length; index += 1) {
    const character = candidate[index];
    if (character === undefined) {
      continue;
    }

    if (start === -1) {
      if (isJsonDocumentWhitespace(character)) {
        continue;
      }
      start = index;
    }

    const stringState = readJsonStringState(character, inString, escaped);
    inString = stringState.inString;
    escaped = stringState.escaped;
    if (stringState.consumed) {
      continue;
    }

    depth += readJsonDepthDelta(character);
    if (depth === 0 && start !== -1 && isJsonDocumentClose(character)) {
      documents.push(candidate.slice(start, index + 1));
      start = -1;
    }
  }

  return documents;
}

function isJsonDocumentWhitespace(character: string): boolean {
  return /\s/u.test(character);
}

function readJsonStringState(
  character: string,
  inString: boolean,
  escaped: boolean,
): { consumed: boolean; escaped: boolean; inString: boolean } {
  if (!inString) {
    return character === '"'
      ? { consumed: true, escaped: false, inString: true }
      : { consumed: false, escaped, inString };
  }

  if (escaped) {
    return { consumed: true, escaped: false, inString };
  }

  if (character === "\\") {
    return { consumed: true, escaped: true, inString };
  }

  return character === '"'
    ? { consumed: true, escaped: false, inString: false }
    : { consumed: true, escaped, inString };
}

function readJsonDepthDelta(character: string): number {
  if (character === "{" || character === "[") {
    return 1;
  }
  return isJsonDocumentClose(character) ? -1 : 0;
}

function isJsonDocumentClose(character: string): boolean {
  return character === "}" || character === "]";
}
