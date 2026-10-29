import { detectEmptyExceptionHandling } from "./analyzer.ts";

const badCode = `try:
    risky_operation()
except:
    pass`;

const findings = detectEmptyExceptionHandling(badCode);

if (findings.length === 1 && findings[0].line === 4) {
  console.log("PASS: empty exception handler detected");
} else {
  console.error("FAIL: empty exception handler test", findings);
  process.exitCode = 1;
}
