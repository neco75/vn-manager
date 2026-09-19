import assert from "node:assert/strict";
import { scheduleSettingsRestore } from "../lib/settings-storage.mjs";

function runRestore(values) {
    const storage = { getItem: (key) => values[key] ?? null };
    let apply;
    let cancelled;
    let backgroundImage = "initial-background";
    let nsfwBlur = false;
    const cleanup = scheduleSettingsRestore(
        storage,
        (value) => { backgroundImage = value; },
        (value) => { nsfwBlur = value; },
        (callback) => { apply = callback; return 1; },
        (timeoutId) => { cancelled = timeoutId; },
    );

    assert.equal(backgroundImage, "initial-background");
    assert.equal(nsfwBlur, false);
    apply();
    cleanup();

    return { backgroundImage, nsfwBlur, cancelled };
}

assert.deepEqual(runRestore({}), {
    backgroundImage: null,
    nsfwBlur: true,
    cancelled: 1,
});
assert.deepEqual(runRestore({
    "vn-manager-bg": "https://example.test/background.jpg",
    "vn-manager-nsfw-blur": "true",
}), {
    backgroundImage: "https://example.test/background.jpg",
    nsfwBlur: true,
    cancelled: 1,
});
assert.deepEqual(runRestore({
    "vn-manager-bg": "https://example.test/background.jpg",
    "vn-manager-nsfw-blur": "false",
}), {
    backgroundImage: "https://example.test/background.jpg",
    nsfwBlur: false,
    cancelled: 1,
});

let applied = false;
let cancelled = false;
const cleanup = scheduleSettingsRestore(
    { getItem: () => "stored" },
    () => { applied = true; },
    () => { applied = true; },
    () => 2,
    () => { cancelled = true; },
);
cleanup();
assert.equal(cancelled, true);
assert.equal(applied, false);

console.log("Settings restoration regression check passed (4 scenarios).");
