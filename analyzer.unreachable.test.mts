import { strict as assert } from "node:assert";
import { detectUnreachableCode } from "./analyzer.ts";

const badCode = [
  "def calculate():",
  "    return 10",
  '    print("This should never run")',
].join("\n");

const badFindings = detectUnreachableCode(badCode);

assert.equal(badFindings.length, 1);
assert.equal(badFindings[0].line, 3);
console.log("PASS: unreachable code after return detected");

const safeCode = [
  "def calculate():",
  '    print("Runs first")',
  "    return 10",
].join("\n");

const safeFindings = detectUnreachableCode(safeCode);

assert.equal(safeFindings.length, 0);
console.log("PASS: normal code is not flagged");
