import { strict as assert } from "node:assert";
import { detectDivisionByZero } from "./analyzer.ts";

const directBug = detectDivisionByZero("result = total / 0");
assert.ok(directBug.length > 0, "Should detect division by literal zero");

const functionBug = detectDivisionByZero(
  "def divide(a, b):\n    return a / b\n\nprint(divide(10, 0))"
);
assert.ok(functionBug.length > 0, "Should detect a function called with zero denominator");

const safeCode = detectDivisionByZero(
  "def divide(a, b):\n    return a / b\n\nprint(divide(10, 2))"
);
assert.equal(safeCode.length, 0, "Should not flag a nonzero literal denominator");

console.log("PASS: direct division-by-zero test");
console.log("PASS: function-call division-by-zero test");
console.log("PASS: safe nonzero function-call test");
