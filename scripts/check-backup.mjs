import assert from "node:assert/strict";
import {
    BACKUP_SCHEMA_VERSION,
    BackupValidationError,
    createBackupDocument,
    createRestorePreview,
    parseBackup,
    planLibraryRestore,
    selectLibraryItemsForRestore,
} from "../lib/backup.ts";

const item = {
    vn: {
        id: "v1",
        title: "Example",
        image: {
            id: "cv1",
            url: "https://t.vndb.org/cv/01/1.jpg",
            sexual: 0,
        },
        tags: [{ name: "Drama" }],
        developers: [{ name: "Studio" }],
        screenshots: [{
            url: "https://t.vndb.org/sf/01/1.jpg",
            thumbnail: "https://t.vndb.org/st/01/1.jpg",
            sexual: 0,
        }],
        extlinks: [{ url: "https://example.test", label: "Official" }],
        releases: [],
    },
    status: "playing",
    score: 50,
    notes: "memo",
    review: "review",
    playTime: 30,
    purchaseLocation: "Steam",
    addedAt: 100,
    updatedAt: 200,
};

const current = createBackupDocument(
    [item],
    ["Steam", "Package"],
    { language: "ja", backgroundImage: null, nsfwBlur: true },
    new Date("2026-09-20T00:00:00.000Z"),
);
assert.equal(current.schemaVersion, BACKUP_SCHEMA_VERSION);
assert.equal(current.exportedAt, "2026-09-20T00:00:00.000Z");

const parsed = parseBackup(current);
assert.equal(parsed.legacy, false);
assert.deepEqual(parsed.library, [item]);
assert.deepEqual(parsed.purchaseSources, ["Steam", "Package"]);
assert.deepEqual(parsed.settings, { language: "ja", backgroundImage: null, nsfwBlur: true });

const legacy = parseBackup([item]);
assert.equal(legacy.legacy, true);
assert.equal(legacy.purchaseSources, undefined);
assert.equal(legacy.settings, undefined);

const existing = [{ ...item, vn: { ...item.vn, id: "v2" } }];
assert.deepEqual(createRestorePreview(parsed, existing), {
    total: 1,
    additions: 1,
    conflicts: 0,
});
assert.deepEqual(createRestorePreview(parsed, [item]), {
    total: 1,
    additions: 0,
    conflicts: 1,
});
assert.deepEqual(selectLibraryItemsForRestore(parsed, [item], false), []);
assert.deepEqual(selectLibraryItemsForRestore(parsed, [item], true), [item]);

const stalePreview = createRestorePreview(parsed, []);
assert.deepEqual(stalePreview, {
    total: 1,
    additions: 1,
    conflicts: 0,
});

const newerDbItem = {
    ...item,
    notes: "saved in another tab",
    updatedAt: 300,
};
const preservePlan = planLibraryRestore(parsed.library, [newerDbItem], false);
assert.deepEqual(preservePlan, {
    itemsToWrite: [],
    additions: 0,
    overwritten: 0,
    skippedConflicts: 1,
});
assert.equal(newerDbItem.notes, "saved in another tab");

const overwritePlan = planLibraryRestore(parsed.library, [newerDbItem], true);
assert.deepEqual(overwritePlan, {
    itemsToWrite: [item],
    additions: 0,
    overwritten: 1,
    skippedConflicts: 0,
});

const additionPlan = planLibraryRestore(parsed.library, [], false);
assert.deepEqual(additionPlan, {
    itemsToWrite: [item],
    additions: 1,
    overwritten: 0,
    skippedConflicts: 0,
});

assert.throws(
    () => parseBackup({ ...current, schemaVersion: 999 }),
    (error) => error instanceof BackupValidationError && /schemaVersion/.test(error.message),
);

assert.throws(
    () => parseBackup({
        ...current,
        library: [item, { ...item, score: 101, vn: { ...item.vn, id: "v2" } }],
    }),
    (error) => error instanceof BackupValidationError && /library\[1\]\.score/.test(error.message),
);

assert.throws(
    () => parseBackup({
        ...current,
        library: [item, structuredClone(item)],
    }),
    (error) => error instanceof BackupValidationError && /duplicate id v1/.test(error.message),
);

assert.throws(
    () => parseBackup({
        ...current,
        purchaseSources: ["Steam", "Steam"],
    }),
    (error) => error instanceof BackupValidationError && /duplicate purchase source/.test(error.message),
);

assert.throws(
    () => parseBackup({
        ...current,
        library: [{
            ...item,
            vn: {
                ...item.vn,
                image: { ...item.vn.image, url: "https://example.test/not-allowed.jpg" },
            },
        }],
    }),
    (error) => error instanceof BackupValidationError && /allowed image host/.test(error.message),
);

assert.throws(
    () => parseBackup({
        ...current,
        library: [{
            ...item,
            vn: {
                ...item.vn,
                extlinks: [{ url: "javascript:alert(1)", label: "Bad" }],
            },
        }],
    }),
    (error) => error instanceof BackupValidationError && /http or https/.test(error.message),
);

assert.throws(
    () => parseBackup({
        ...current,
        settings: {
            ...current.settings,
            backgroundImage: "https://example.test/background.jpg",
        },
    }),
    (error) => error instanceof BackupValidationError && /settings\.backgroundImage/.test(error.message),
);

assert.throws(
    () => parseBackup([item, { ...item, vn: { id: "v2", title: "" } }]),
    (error) => error instanceof BackupValidationError && /legacy\[1\]\.vn\.title/.test(error.message),
);

console.log("Backup validation regression check passed (17 scenarios).");
