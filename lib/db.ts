import { openDB, DBSchema, IDBPDatabase } from "idb";
import { LibraryItem } from "@/types/library";

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
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<VNDBManagerDB>>;

export function getDB() {
    if (!dbPromise) {
        dbPromise = openDB<VNDBManagerDB>(DB_NAME, DB_VERSION, {
            upgrade(db, oldVersion, newVersion, transaction) {
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
            },
        });
    }
    return dbPromise;
}

export async function addToLibrary(item: LibraryItem) {
    const db = await getDB();
    return db.put("library", item);
}

export async function getLibraryItem(id: string) {
    const db = await getDB();
    return db.get("library", id);
}

export async function getAllLibraryItems() {
    const db = await getDB();
    return db.getAll("library");
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
