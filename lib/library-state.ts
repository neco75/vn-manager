import type { LibraryItem } from "../types/library";
import type { VN } from "../types/vndb";

export type LibraryItemEdits = Pick<
    LibraryItem,
    "status" | "score" | "notes" | "playTime" | "purchaseLocation"
>;

interface NewLibraryItemValues extends LibraryItemEdits {
    vn: VN;
    review: string;
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
        addedAt: now,
        updatedAt: now,
    };
}
