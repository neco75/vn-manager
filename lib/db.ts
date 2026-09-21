import { openDB, DBSchema, IDBPDatabase } from "idb";
import { assertValidLibraryItem, LibraryItem } from "@/types/library";
import { migrateLibraryRecord } from "@/lib/library-record.mjs";
import { planLibraryRestore } from "@/lib/backup";
import type { VN } from "@/types/vndb";

interface VNDBManagerDB extends DBSchema {
    library: {
        key: string;
        value: LibraryItem;
        indexes: { "by-status": string };
    };
    purchase_sources: {
        key: string;
        value: { name: string };
    };
}

const DB_NAME = "vn-manager-db";
const DB_VERSION = 3;

let dbPromise: Promise<IDBPDatabase<VNDBManagerDB>>;

export class LibraryConflictError extends Error {
    constructor(public readonly vnId: string) {
        super(`Library item changed before it could be saved: ${vnId}`);
        this.name = "LibraryConflictError";
    }
}

function errorName(error: unknown): string | null {
    return typeof error === "object" && error !== null && "name" in error
        ? String(error.name)
        : null;
}

function nextUpdatedAt(previousUpdatedAt: number): number {
    return Math.max(Date.now(), previousUpdatedAt + 1);
}

export function getDB() {
    if (!dbPromise) {
        dbPromise = openDB<VNDBManagerDB>(DB_NAME, DB_VERSION, {
            upgrade(db, oldVersion, _newVersion, transaction) {
                if (oldVersion < 1) {
                    const store = db.createObjectStore("library", { keyPath: "vn.id" });
                    store.createIndex("by-status", "status");
                }
                if (oldVersion < 2) {
                    const store = db.createObjectStore("purchase_sources", { keyPath: "name" });
                    store.add({ name: "Steam" });
                    store.add({ name: "DMM" });
                    store.add({ name: "Package" });
                }
                if (oldVersion < 3) {
                    const libraryStore = transaction.objectStore("library");
                    void (async () => {
                        let cursor = await libraryStore.openCursor();
                        while (cursor) {
                            await cursor.update(migrateLibraryRecord(cursor.value) as LibraryItem);
                            cursor = await cursor.continue();
                        }
                    })();
                }
            },
        });
    }
    return dbPromise;
}

export async function addLibraryItemIfAbsent(item: LibraryItem) {
    assertValidLibraryItem(item);
    const db = await getDB();
    const tx = db.transaction("library", "readwrite");

    try {
        await tx.objectStore("library").add(item);
        await tx.done;
        return item;
    } catch (error) {
        await tx.done.catch(() => undefined);
        if (errorName(error) === "ConstraintError") {
            throw new LibraryConflictError(item.vn.id);
        }
        throw error;
    }
}

export async function updateLibraryItem(item: LibraryItem) {
    assertValidLibraryItem(item);
    const db = await getDB();
    const tx = db.transaction("library", "readwrite");

    try {
        const store = tx.objectStore("library");
        const currentItem = await store.get(item.vn.id);
        if (!currentItem || currentItem.updatedAt !== item.updatedAt) {
            await tx.done;
            throw new LibraryConflictError(item.vn.id);
        }

        const updatedItem = {
            ...item,
            updatedAt: nextUpdatedAt(currentItem.updatedAt),
        };
        await store.put(updatedItem);
        await tx.done;
        return updatedItem;
    } catch (error) {
        await tx.done.catch(() => undefined);
        throw error;
    }
}

export async function updateLibraryItemMetadata(id: string, vn: VN) {
    const db = await getDB();
    const tx = db.transaction("library", "readwrite");

    try {
        const store = tx.objectStore("library");
        const currentItem = await store.get(id);
        if (!currentItem) {
            await tx.done;
            return null;
        }

        const updatedItem = {
            ...currentItem,
            vn,
            updatedAt: nextUpdatedAt(currentItem.updatedAt),
        };
        assertValidLibraryItem(updatedItem);
        await store.put(updatedItem);
        await tx.done;
        return updatedItem;
    } catch (error) {
        await tx.done.catch(() => undefined);
        throw error;
    }
}

export async function getLibraryItem(id: string) {
    const db = await getDB();
    return db.get("library", id);
}

export async function getAllLibraryItems() {
    const db = await getDB();
    return db.getAll("library");
}


export async function restoreBackupData(
    items: LibraryItem[],
    purchaseSources?: string[],
    overwriteConflicts = false,
) {
    items.forEach(assertValidLibraryItem);

    const db = await getDB();
    const tx = db.transaction(["library", "purchase_sources"], "readwrite");
    const libraryStore = tx.objectStore("library");
    const purchaseSourceStore = tx.objectStore("purchase_sources");

    // Read and decide conflicts inside the same readwrite transaction that performs
    // the writes. This prevents a stale React Context / preview from overwriting a
    // record that another tab saved before this restore started.
    const existingItems = await libraryStore.getAll();
    const plan = planLibraryRestore(items, existingItems, overwriteConflicts);
    const finalItems = new Map(existingItems.map((item) => [item.vn.id, item]));

    for (const item of plan.itemsToWrite) {
        await libraryStore.put(item);
        finalItems.set(item.vn.id, item);
    }

    if (purchaseSources) {
        const finalSources = new Set(purchaseSources);
        for (const item of finalItems.values()) {
            if (item.purchaseLocation) {
                finalSources.add(item.purchaseLocation);
            }
        }

        await purchaseSourceStore.clear();
        for (const name of finalSources) {
            await purchaseSourceStore.put({ name });
        }
    }

    await tx.done;
    return {
        additions: plan.additions,
        overwritten: plan.overwritten,
        skippedConflicts: plan.skippedConflicts,
    };
}

export async function removeFromLibrary(id: string) {
    const db = await getDB();
    return db.delete("library", id);
}

export async function getAllPurchaseSources() {
    const db = await getDB();
    return db.getAll("purchase_sources");
}


export async function addPurchaseSource(name: string) {
    const db = await getDB();
    return db.put("purchase_sources", { name });
}

export async function updatePurchaseSource(oldName: string, newName: string) {
    const db = await getDB();
    const tx = db.transaction(["purchase_sources", "library"], "readwrite");

    // 1. Update the source name in purchase_sources
    await tx.objectStore("purchase_sources").delete(oldName);
    await tx.objectStore("purchase_sources").add({ name: newName });

    // 2. Update all library items that use this source
    const libraryStore = tx.objectStore("library");
    let cursor = await libraryStore.openCursor();

    while (cursor) {
        const item = cursor.value;
        if (item.purchaseLocation === oldName) {
            const updatedItem = { ...item, purchaseLocation: newName, updatedAt: Date.now() };
            await cursor.update(updatedItem);
        }
        cursor = await cursor.continue();
    }

    await tx.done;
}

export async function deletePurchaseSource(name: string) {
    const db = await getDB();
    return db.delete("purchase_sources", name);
}
