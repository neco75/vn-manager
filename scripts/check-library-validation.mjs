import assert from "node:assert/strict";
import {
    createLibraryItemForAdd,
    mergeLibraryItemEdits,
    mergeLibraryItemMetadata,
    upsertLibraryItem,
} from "../lib/library-state.ts";
import { getLibraryValidationError } from "../types/library.ts";
import {
    LIBRARY_RECORD_VERSION,
    migrateLibraryRecord,
} from "../lib/library-record.mjs";

const valid = {
    status: "playing",
    ownership: "unknown",
    score: 50,
    playTime: 0,
};

assert.equal(getLibraryValidationError(valid), null);
assert.equal(getLibraryValidationError({ ...valid, score: null }), null);
assert.equal(getLibraryValidationError({ ...valid, score: 0 }), null);
assert.equal(getLibraryValidationError({ ...valid, score: 100 }), null);
assert.equal(getLibraryValidationError({ ...valid, playTime: undefined }), null);
assert.equal(getLibraryValidationError({ ...valid, playTime: 30.5 }), null);
assert.equal(getLibraryValidationError({ ...valid, ownership: "owned" }), null);
assert.equal(getLibraryValidationError({ ...valid, ownership: "wishlist" }), null);
assert.equal(getLibraryValidationError({ ...valid, startedOn: "2026-01-01", completedOn: "2026-01-02" }), null);
assert.equal(getLibraryValidationError({ ...valid, lastPlayedOn: "2026-09-20" }), null);
assert.equal(getLibraryValidationError({ ...valid, resumeNote: "route B next" }), null);

assert.equal(getLibraryValidationError({ ...valid, status: "unknown" }), "status");
assert.equal(getLibraryValidationError({ ...valid, ownership: "borrowed" }), "ownership");
assert.equal(getLibraryValidationError({ ...valid, score: -1 }), "score");
assert.equal(getLibraryValidationError({ ...valid, score: 101 }), "score");
assert.equal(getLibraryValidationError({ ...valid, score: 1.5 }), "score");
assert.equal(getLibraryValidationError({ ...valid, score: Number.NaN }), "score");
assert.equal(getLibraryValidationError({ ...valid, score: Number.POSITIVE_INFINITY }), "score");
assert.equal(getLibraryValidationError({ ...valid, playTime: -1 }), "playTime");
assert.equal(getLibraryValidationError({ ...valid, playTime: Number.NaN }), "playTime");
assert.equal(getLibraryValidationError({ ...valid, startedOn: "2026-02-30" }), "startedOn");
assert.equal(getLibraryValidationError({ ...valid, completedOn: "09/20/2026" }), "completedOn");
assert.equal(getLibraryValidationError({ ...valid, lastPlayedOn: "2026-9-20" }), "lastPlayedOn");
assert.equal(
    getLibraryValidationError({ ...valid, startedOn: "2026-09-20", completedOn: "2026-09-19" }),
    "dateOrder",
);
assert.equal(getLibraryValidationError({ ...valid, resumeNote: "x".repeat(201) }), "resumeNote");

const legacyZero = {
    vn: { id: "v90", title: "Legacy zero" },
    status: "completed",
    score: 0,
    notes: "legacy memo",
    review: "legacy review",
    playTime: 60,
    purchaseLocation: "Package",
    addedAt: 10,
    updatedAt: 20,
};
const migratedLegacyZero = migrateLibraryRecord(legacyZero);
assert.equal(migratedLegacyZero.recordVersion, LIBRARY_RECORD_VERSION);
assert.equal(migratedLegacyZero.ownership, "unknown");
assert.equal(migratedLegacyZero.score, null);
assert.equal(migratedLegacyZero.notes, "legacy memo");
assert.equal(migratedLegacyZero.review, "legacy review");
assert.equal(migratedLegacyZero.purchaseLocation, "Package");
assert.equal(migratedLegacyZero.addedAt, 10);
assert.equal(migratedLegacyZero.updatedAt, 20);
assert.deepEqual(migrateLibraryRecord(migratedLegacyZero), migratedLegacyZero);

const currentZero = {
    ...migratedLegacyZero,
    vn: { id: "v91", title: "Current zero" },
    score: 0,
};
assert.equal(migrateLibraryRecord(currentZero).score, 0);

const detailedVN = {
    id: "v1",
    title: "Detailed VN",
    screenshots: [{ url: "https://example.test/full.jpg", thumbnail: "https://example.test/thumb.jpg" }],
    extlinks: [{ id: "official", url: "https://example.test", label: "Official" }],
};
const existingItem = {
    recordVersion: LIBRARY_RECORD_VERSION,
    vn: detailedVN,
    status: "playing",
    ownership: "owned",
    score: 70,
    notes: "old memo",
    review: "keep this review",
    playTime: 120,
    purchaseLocation: "Steam",
    startedOn: "2026-09-01",
    lastPlayedOn: "2026-09-10",
    resumeNote: "chapter 3",
    addedAt: 100,
    updatedAt: 150,
};

const editedItem = mergeLibraryItemEdits(existingItem, {
    status: "completed",
    ownership: "owned",
    score: 0,
    notes: "new memo",
    review: "keep this review",
    playTime: 180,
    purchaseLocation: "Package",
    startedOn: "2026-09-01",
    completedOn: "2026-09-20",
    lastPlayedOn: "2026-09-20",
    resumeNote: "",
});
assert.strictEqual(editedItem.vn, detailedVN);
assert.equal(editedItem.score, 0);
assert.equal(editedItem.completedOn, "2026-09-20");
assert.equal(editedItem.addedAt, 100);

const duplicateState = upsertLibraryItem(
    [existingItem, { ...existingItem, updatedAt: 151 }],
    editedItem,
);
assert.equal(duplicateState.filter((item) => item.vn.id === "v1").length, 1);
assert.strictEqual(duplicateState.at(-1), editedItem);

const beforeDuplicateAdd = structuredClone(existingItem);
assert.throws(
    () => createLibraryItemForAdd(existingItem, {
        vn: { id: "v1", title: "Search result without details" },
        status: "plan_to_play",
        ownership: "wishlist",
        score: null,
        notes: "",
        playTime: 0,
    }, 200),
    /Library item already exists: v1/,
);
assert.deepEqual(existingItem, beforeDuplicateAdd);

const refreshedMetadata = mergeLibraryItemMetadata(
    existingItem,
    {
        ...detailedVN,
        title: "Refreshed VN title",
        rating: 88,
    },
    250,
);
assert.equal(refreshedMetadata.vn.title, "Refreshed VN title");
assert.equal(refreshedMetadata.status, existingItem.status);
assert.equal(refreshedMetadata.ownership, existingItem.ownership);
assert.equal(refreshedMetadata.score, existingItem.score);
assert.equal(refreshedMetadata.notes, existingItem.notes);
assert.equal(refreshedMetadata.review, existingItem.review);
assert.equal(refreshedMetadata.startedOn, existingItem.startedOn);
assert.equal(refreshedMetadata.lastPlayedOn, existingItem.lastPlayedOn);
assert.equal(refreshedMetadata.resumeNote, existingItem.resumeNote);
assert.equal(refreshedMetadata.addedAt, existingItem.addedAt);
assert.equal(refreshedMetadata.updatedAt, 250);

const newItem = createLibraryItemForAdd(undefined, {
    vn: { id: "v2", title: "New VN" },
    status: "plan_to_play",
    ownership: "unknown",
    score: null,
    notes: "",
    playTime: 0,
}, 300);
assert.equal(newItem.recordVersion, LIBRARY_RECORD_VERSION);
assert.equal(newItem.vn.id, "v2");
assert.equal(newItem.ownership, "unknown");
assert.equal(newItem.score, null);
assert.equal(newItem.addedAt, 300);
assert.equal(newItem.updatedAt, 300);

const newZeroItem = createLibraryItemForAdd(undefined, {
    vn: { id: "v3", title: "Zero VN" },
    status: "completed",
    ownership: "owned",
    score: 0,
    notes: "",
    playTime: 0,
}, 301);
assert.equal(newZeroItem.score, 0);
assert.equal(migrateLibraryRecord(newZeroItem).score, 0);

const ownedBacklog = [newItem, { ...newItem, vn: { id: "v4", title: "Owned" }, ownership: "owned" }]
    .filter((item) => item.ownership === "owned" && item.status === "plan_to_play");
const wishlist = [newItem, { ...newItem, vn: { id: "v5", title: "Wish" }, ownership: "wishlist" }]
    .filter((item) => item.ownership === "wishlist");
assert.equal(ownedBacklog.length, 1);
assert.equal(wishlist.length, 1);

console.log("Library save regression check passed (48 scenarios).");
