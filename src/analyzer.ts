
export type Severity = "HIGH" | "MEDIUM" | "LOW";

export interface Finding {
  id: string;
  ruleId: string;
  title: string;
  severity: Severity;
  line: number;
  message: string;
  evidence: string;
  recommendation: string;
}

export function detectDivisionByZero(code: string): Finding[] {
  const findings: Finding[] = [];
  const lines = code.split(/\r?\n/);

  // Detect direct division by zero, such as x / 0.
  lines.forEach((line, index) => {
    if (/\/\s*0(?:\.0+)?(?:\s|$|[,)])/.test(line)) {
      findings.push({
        id: `BUG-DIV-${index + 1}`,
        ruleId: "BUG-DIV-001",
        title: "Potential division by zero",
        severity: "HIGH",
        line: index + 1,
        message: "This expression divides by the literal zero.",
        evidence: line.trim(),
        recommendation:
          "Check that the denominator is not zero before dividing.",
      });
    }
  });

  // Find simple Python functions that divide by a parameter.
  const functions: {
    name: string;
    params: string[];
    denominator: string;
    line: number;
  }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const definition = lines[i].match(
      /^\s*def\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*:/
    );

    if (!definition) continue;

    const name = definition[1];
    const params = definition[2]
      .split(",")
      .map((p) => p.trim().split("=")[0].trim())
      .filter(Boolean);

    const indentation = lines[i].match(/^\s*/)?.[0].length ?? 0;

    for (let j = i + 1; j < lines.length; j++) {
      const bodyLine = lines[j];

      if (!bodyLine.trim() || bodyLine.trim().startsWith("#")) {
        continue;
      }

      const bodyIndent =
        bodyLine.match(/^\s*/)?.[0].length ?? 0;

      if (bodyIndent <= indentation) break;

      const division = bodyLine.match(/\/\s*([A-Za-z_]\w*)/);

      if (division && params.includes(division[1])) {
        functions.push({
          name,
          params,
          denominator: division[1],
          line: j + 1,
        });
      }
    }
  }

  // Detect calls such as divide(10, 0).
  for (const fn of functions) {
    const parameterIndex = fn.params.indexOf(fn.denominator);

    const callPattern = new RegExp(
      String.raw`(?:^|[^.\w])${fn.name}\s*\(([^)]*)\)`,
      "g"
    );

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (/^\s*def\s/.test(line)) continue;

      let match: RegExpExecArray | null;

      while ((match = callPattern.exec(line)) !== null) {
        const args = match[1]
          .split(",")
          .map((arg) => arg.trim());

        if (
          parameterIndex >= 0 &&
          /^[-+]?0(?:\.0+)?$/.test(args[parameterIndex] ?? "")
        ) {
          findings.push({
            id: `BUG-DIV-${fn.line}-${i + 1}`,
            ruleId: "BUG-DIV-001",
            title: "Potential division by zero",
            severity: "HIGH",
            line: fn.line,
            message:
              `Function "${fn.name}" divides by parameter ` +
              `"${fn.denominator}", but a call on line ${i + 1} ` +
              "passes zero for that parameter.",
            evidence:
              `${lines[fn.line - 1].trim()}\nCall: ${line.trim()}`,
            recommendation:
              "Validate the denominator before performing division.",
          });
        }
      }
    }
  }

  // Remove duplicate findings.
  return findings.filter(
    (finding, index, all) =>
      all.findIndex(
        (item) =>
          item.ruleId === finding.ruleId &&
          item.line === finding.line &&
          item.message === finding.message
      ) === index
  );
}
