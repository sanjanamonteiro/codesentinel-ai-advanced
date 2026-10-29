import { strict as assert } from "node:assert";
import { detectDivisionByZero } from "./analyzer.ts";

const negativeZero = detectDivisionByZero("result = value / -0");
console.log("Negative zero detected:", negativeZero.length > 0);

const safeDecimal = detectDivisionByZero("result = value / 0.5");
assert.equal(safeDecimal.length, 0, "Safe decimal division should not be flagged");
console.log("PASS: safe decimal division");

const comment = detectDivisionByZero("# example: result = value / 0");
console.log("Comment flagged:", comment.length > 0);

console.log("\nCoverage check complete.");
