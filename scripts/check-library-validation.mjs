import assert from "node:assert/strict";
import { getLibraryValidationError } from "../types/library.ts";

const valid = {
    status: "playing",
    score: 50,
    playTime: 0,
};

assert.equal(getLibraryValidationError(valid), null);
assert.equal(getLibraryValidationError({ ...valid, score: 0 }), null);
assert.equal(getLibraryValidationError({ ...valid, score: 100 }), null);
assert.equal(getLibraryValidationError({ ...valid, playTime: undefined }), null);
assert.equal(getLibraryValidationError({ ...valid, playTime: 30.5 }), null);

assert.equal(getLibraryValidationError({ ...valid, status: "unknown" }), "status");
assert.equal(getLibraryValidationError({ ...valid, score: -1 }), "score");
assert.equal(getLibraryValidationError({ ...valid, score: 101 }), "score");
assert.equal(getLibraryValidationError({ ...valid, score: 1.5 }), "score");
assert.equal(getLibraryValidationError({ ...valid, score: Number.NaN }), "score");
assert.equal(getLibraryValidationError({ ...valid, score: Number.POSITIVE_INFINITY }), "score");
assert.equal(getLibraryValidationError({ ...valid, playTime: -1 }), "playTime");
assert.equal(getLibraryValidationError({ ...valid, playTime: Number.NaN }), "playTime");
assert.equal(getLibraryValidationError({ ...valid, playTime: Number.POSITIVE_INFINITY }), "playTime");

console.log("Library validation regression check passed (14 scenarios).");
