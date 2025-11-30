import { openDB, DBSchema, IDBPDatabase } from "idb";
import { LibraryItem } from "@/types/library";

interface VNDBManagerDB extends DBSchema {
    library: {
        key: string;
        value: LibraryItem;
        indexes: { "by-status": string };
    };
}

const DB_NAME = "vn-manager-db";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<VNDBManagerDB>>;

export function getDB() {
    if (!dbPromise) {
        dbPromise = openDB<VNDBManagerDB>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                const store = db.createObjectStore("library", { keyPath: "vn.id" });
                store.createIndex("by-status", "status");
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
