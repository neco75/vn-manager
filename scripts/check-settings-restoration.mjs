import assert from "node:assert/strict";
import { scheduleSettingsRestore } from "../lib/settings-storage.mjs";

function runRestore(values) {
    const storage = { getItem: (key) => values[key] ?? null };
    let apply;
    let cancelled;
    let backgroundImage = "initial-background";
    let nsfwBlur = false;
    let backgroundImageSexual = "initial";
    const cleanup = scheduleSettingsRestore(
        storage,
        (value) => { backgroundImage = value; },
        (value) => { nsfwBlur = value; },
        (callback) => { apply = callback; return 1; },
        (timeoutId) => { cancelled = timeoutId; },
        (value) => { backgroundImageSexual = value; },
    );

    assert.equal(backgroundImage, "initial-background");
    assert.equal(nsfwBlur, false);
    apply();
    cleanup();

    return { backgroundImage, backgroundImageSexual, nsfwBlur, cancelled };
}

assert.deepEqual(runRestore({}), {
    backgroundImage: null,
    backgroundImageSexual: null,
    nsfwBlur: true,
    cancelled: 1,
});
assert.deepEqual(runRestore({
    "vn-manager-bg": "https://example.test/background.jpg",
    "vn-manager-bg-sexual": "0",
    "vn-manager-nsfw-blur": "true",
}), {
    backgroundImage: "https://example.test/background.jpg",
    backgroundImageSexual: 0,
    nsfwBlur: true,
    cancelled: 1,
});
assert.deepEqual(runRestore({
    "vn-manager-bg": "https://example.test/background.jpg",
    "vn-manager-bg-sexual": "1.5",
    "vn-manager-nsfw-blur": "false",
}), {
    backgroundImage: "https://example.test/background.jpg",
    backgroundImageSexual: 1.5,
    nsfwBlur: false,
    cancelled: 1,
});

assert.deepEqual(runRestore({
    "vn-manager-bg": "https://example.test/legacy-background.jpg",
    "vn-manager-bg-sexual": "invalid",
}), {
    backgroundImage: "https://example.test/legacy-background.jpg",
    backgroundImageSexual: null,
    nsfwBlur: true,
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

console.log("Settings restoration regression check passed (5 scenarios).");
