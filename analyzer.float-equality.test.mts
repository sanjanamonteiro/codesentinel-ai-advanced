import { detectRiskyFloatEquality } from "./analyzer.ts";

const findings = detectRiskyFloatEquality(
  "if total == 0.3:\n    print('match')"
);

if (findings.length === 1 && findings[0].line === 1) {
  console.log("PASS: risky floating-point equality detected");
} else {
  console.error("FAIL: floating-point equality test", findings);
  process.exitCode = 1;
}
