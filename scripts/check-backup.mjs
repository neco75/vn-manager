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

const legacyItem = {
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
    score: 0,
    notes: "memo",
    review: "review",
    playTime: 30,
    purchaseLocation: "Steam",
    addedAt: 100,
    updatedAt: 200,
};

const item = {
    ...legacyItem,
    recordVersion: 2,
    ownership: "owned",
    score: 0,
    startedOn: "2026-09-01",
    completedOn: "2026-09-20",
    lastPlayedOn: "2026-09-20",
    resumeNote: "epilogue",
};

const current = createBackupDocument(
    [item],
    ["Steam", "Package"],
    { language: "ja", backgroundImage: null, nsfwBlur: true },
    new Date("2026-09-20T00:00:00.000Z"),
);
assert.equal(BACKUP_SCHEMA_VERSION, 2);
assert.equal(current.schemaVersion, BACKUP_SCHEMA_VERSION);
assert.equal(current.exportedAt, "2026-09-20T00:00:00.000Z");

const parsed = parseBackup(current);
assert.equal(parsed.legacy, false);
assert.deepEqual(parsed.library, [item]);
assert.equal(parsed.library[0].score, 0);
assert.deepEqual(parsed.purchaseSources, ["Steam", "Package"]);
assert.deepEqual(parsed.settings, { language: "ja", backgroundImage: null, nsfwBlur: true });

const versionOne = parseBackup({
    ...current,
    schemaVersion: 1,
    library: [legacyItem],
});
assert.equal(versionOne.legacy, false);
assert.equal(versionOne.schemaVersion, 1);
assert.equal(versionOne.library[0].recordVersion, 2);
assert.equal(versionOne.library[0].ownership, "unknown");
assert.equal(versionOne.library[0].score, null);
assert.deepEqual(versionOne.purchaseSources, ["Steam", "Package"]);
assert.deepEqual(versionOne.settings, current.settings);

const legacy = parseBackup([legacyItem]);
assert.equal(legacy.legacy, true);
assert.equal(legacy.library[0].recordVersion, 2);
assert.equal(legacy.library[0].ownership, "unknown");
assert.equal(legacy.library[0].score, null);
assert.equal(legacy.purchaseSources, undefined);
assert.equal(legacy.settings, undefined);

const legacyRated = parseBackup([{ ...legacyItem, vn: { ...legacyItem.vn, id: "v2" }, score: 75 }]);
assert.equal(legacyRated.library[0].score, 75);

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
        library: [item, { ...item, ownership: "borrowed" }],
    }),
    (error) => error instanceof BackupValidationError && /ownership/.test(error.message),
);

assert.throws(
    () => parseBackup({
        ...current,
        library: [item, { ...item, startedOn: "2026-02-30" }],
    }),
    (error) => error instanceof BackupValidationError && /startedOn/.test(error.message),
);

assert.throws(
    () => parseBackup({
        ...current,
        library: [item, { ...item, startedOn: "2026-09-20", completedOn: "2026-09-19" }],
    }),
    (error) => error instanceof BackupValidationError && /completedOn/.test(error.message),
);

assert.throws(
    () => parseBackup({
        ...current,
        library: [item, { ...item, resumeNote: "x".repeat(201) }],
    }),
    (error) => error instanceof BackupValidationError && /resumeNote/.test(error.message),
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
    () => parseBackup([legacyItem, { ...legacyItem, vn: { id: "v2", title: "" } }]),
    (error) => error instanceof BackupValidationError && /legacy\[1\]\.vn\.title/.test(error.message),
);

console.log("Backup validation regression check passed (27 scenarios).");
