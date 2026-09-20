import assert from "node:assert/strict";
import { shouldBlurImage } from "../lib/image-safety.ts";

for (const value of [0, 0.5]) {
    assert.equal(shouldBlurImage(value, true), false, `${value} should remain visible`);
}
for (const value of [1, 1.5, 2, undefined, null, Number.NaN, -1, 3, "1"]) {
    assert.equal(shouldBlurImage(value, true), true, `${String(value)} should blur when enabled`);
}
for (const value of [0, 1, 1.5, 2, undefined, null, Number.NaN]) {
    assert.equal(shouldBlurImage(value, false), false, `${String(value)} should remain visible when disabled`);
}

console.log("Image safety regression check passed (18 scenarios).");
