import assert from "node:assert/strict";
import {
    createLibraryItemForAdd,
    mergeLibraryItemEdits,
    mergeLibraryItemMetadata,
    upsertLibraryItem,
} from "../lib/library-state.ts";
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

const detailedVN = {
    id: "v1",
    title: "Detailed VN",
    screenshots: [{ url: "https://example.test/full.jpg", thumbnail: "https://example.test/thumb.jpg" }],
    extlinks: [{ id: "official", url: "https://example.test", label: "Official" }],
};
const existingItem = {
    vn: detailedVN,
    status: "playing",
    score: 70,
    notes: "old memo",
    review: "keep this review",
    playTime: 120,
    purchaseLocation: "Steam",
    addedAt: 100,
    updatedAt: 150,
};

const editedItem = mergeLibraryItemEdits(existingItem, {
    status: "completed",
    score: 90,
    notes: "new memo",
    playTime: 180,
    purchaseLocation: "Package",
});
assert.strictEqual(editedItem.vn, detailedVN);
assert.equal(editedItem.review, "keep this review");
assert.equal(editedItem.addedAt, 100);
assert.deepEqual(
    {
        status: editedItem.status,
        score: editedItem.score,
        notes: editedItem.notes,
        playTime: editedItem.playTime,
        purchaseLocation: editedItem.purchaseLocation,
    },
    {
        status: "completed",
        score: 90,
        notes: "new memo",
        playTime: 180,
        purchaseLocation: "Package",
    },
);

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
        score: 0,
        notes: "",
        playTime: 0,
        review: "",
        purchaseLocation: "",
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
assert.equal(refreshedMetadata.vn.rating, 88);
assert.equal(refreshedMetadata.status, existingItem.status);
assert.equal(refreshedMetadata.score, existingItem.score);
assert.equal(refreshedMetadata.notes, existingItem.notes);
assert.equal(refreshedMetadata.review, existingItem.review);
assert.equal(refreshedMetadata.playTime, existingItem.playTime);
assert.equal(refreshedMetadata.purchaseLocation, existingItem.purchaseLocation);
assert.equal(refreshedMetadata.addedAt, existingItem.addedAt);
assert.equal(refreshedMetadata.updatedAt, 250);

const newItem = createLibraryItemForAdd(undefined, {
    vn: { id: "v2", title: "New VN" },
    status: "plan_to_play",
    score: 0,
    notes: "",
    playTime: 0,
    review: "",
    purchaseLocation: "",
}, 300);
assert.equal(newItem.vn.id, "v2");
assert.equal(newItem.addedAt, 300);
assert.equal(newItem.updatedAt, 300);

console.log("Library save regression check passed (28 scenarios).");
