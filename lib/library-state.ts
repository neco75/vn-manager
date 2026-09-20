import type { LibraryItem } from "../types/library";
import { LIBRARY_RECORD_VERSION } from "./library-record.mjs";
import type { VN } from "../types/vndb";

export type LibraryItemEdits = Pick<
    LibraryItem,
    | "status"
    | "ownership"
    | "score"
    | "notes"
    | "review"
    | "playTime"
    | "purchaseLocation"
    | "startedOn"
    | "completedOn"
    | "lastPlayedOn"
    | "resumeNote"
>;

interface NewLibraryItemValues extends LibraryItemEdits {
    vn: VN;
}

export function mergeLibraryItemEdits(
    existingItem: LibraryItem,
    edits: LibraryItemEdits,
): LibraryItem {
    return {
        ...existingItem,
        ...edits,
    };
}

export function upsertLibraryItem(
    items: LibraryItem[],
    item: LibraryItem,
): LibraryItem[] {
    return [...items.filter((existing) => existing.vn.id !== item.vn.id), item];
}

export function mergeLibraryItemMetadata(
    existingItem: LibraryItem,
    vn: VN,
    now: number = Date.now(),
): LibraryItem {
    return {
        ...existingItem,
        vn,
        updatedAt: now,
    };
}

export function createLibraryItemForAdd(
    existingItem: LibraryItem | undefined,
    values: NewLibraryItemValues,
    now: number = Date.now(),
): LibraryItem {
    if (existingItem) {
        throw new Error(`Library item already exists: ${existingItem.vn.id}`);
    }

    return {
        ...values,
        recordVersion: LIBRARY_RECORD_VERSION,
        ownership: values.ownership ?? "unknown",
        score: values.score ?? null,
        notes: values.notes ?? "",
        review: values.review ?? "",
        playTime: values.playTime ?? 0,
        addedAt: now,
        updatedAt: now,
    };
}
