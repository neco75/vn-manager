"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { LibraryItem } from "@/types/library";
import { VN } from "@/types/vndb";
import * as db from "@/lib/db";
import { createLibraryItemForAdd, upsertLibraryItem, type LibraryItemEdits } from "@/lib/library-state";

interface LibraryContextType {
    items: LibraryItem[];
    purchaseSources: string[];
    isLoading: boolean;
    loadError: boolean;
    reloadLibrary: () => Promise<void>;
    addItem: (vn: VN, edits: LibraryItemEdits) => Promise<void>;
    updateItem: (item: LibraryItem) => Promise<void>;
    removeItem: (id: string) => Promise<void>;
    getItem: (id: string) => LibraryItem | undefined;
    addPurchaseSource: (name: string) => Promise<void>;
    updatePurchaseSource: (oldName: string, newName: string) => Promise<void>;
    deletePurchaseSource: (name: string) => Promise<void>;
    refreshNSFWFlags: (onProgress?: (current: number, total: number) => void) => Promise<number>;
}

const LibraryContext = createContext<LibraryContextType | undefined>(undefined);


export function LibraryProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<LibraryItem[]>([]);
    const [purchaseSources, setPurchaseSources] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);

    useEffect(() => {
        void loadLibrary();
    }, []);

    async function loadLibrary(rethrow = false) {
        setIsLoading(true);
        setLoadError(false);
        try {
            const [loadedItems, loadedSources] = await Promise.all([
                db.getAllLibraryItems(),
                db.getAllPurchaseSources()
            ]);
            setItems(loadedItems);
            setPurchaseSources(loadedSources.map(s => s.name));
        } catch (error) {
            console.error("Failed to load library:", error);
            setLoadError(true);
            if (rethrow) throw error;
        } finally {
            setIsLoading(false);
        }
    }

    async function addItem(vn: VN, edits: LibraryItemEdits) {
        const newItem = createLibraryItemForAdd(undefined, {
            vn,
            ...edits,
        });
        const savedItem = await db.addLibraryItemIfAbsent(newItem);
        setItems((prev) => upsertLibraryItem(prev, savedItem));
    }

    async function updateItem(item: LibraryItem) {
        const updatedItem = await db.updateLibraryItem(item);
        setItems((prev) => upsertLibraryItem(prev, updatedItem));
    }

    async function removeItem(id: string) {
        await db.removeFromLibrary(id);
        setItems((prev) => prev.filter((i) => i.vn.id !== id));
    }

    async function addPurchaseSource(name: string) {
        await db.addPurchaseSource(name);
        setPurchaseSources(prev => [...prev, name]);
    }

    async function updatePurchaseSource(oldName: string, newName: string) {
        const updatedItems = await db.updatePurchaseSource(oldName, newName);
        setPurchaseSources(prev => prev.map(s => s === oldName ? newName : s));
        const updatedById = new Map(updatedItems.map((item) => [item.vn.id, item]));
        setItems(prev => prev.map(item => updatedById.get(item.vn.id) ?? item));
    }

    async function deletePurchaseSource(name: string) {
        await db.deletePurchaseSource(name);
        setPurchaseSources(prev => prev.filter(s => s !== name));
    }

    async function refreshNSFWFlags(onProgress?: (current: number, total: number) => void) {
        if (items.length === 0) return 0;

        const { getVNsByIds } = await import("@/lib/vndb");
        const ids = items.map(i => i.vn.id);

        try {
            const updatedVNs = await getVNsByIds(ids, onProgress);
            const results = await Promise.all(
                updatedVNs.map(async (updatedVN) => ({
                    id: updatedVN.id,
                    item: await db.updateLibraryItemMetadata(updatedVN.id, updatedVN),
                })),
            );
            const updatedItems = results.flatMap(({ item }) => item ? [item] : []);
            const missingIds = new Set(
                results.filter(({ item }) => !item).map(({ id }) => id),
            );
            const updatedById = new Map(updatedItems.map((item) => [item.vn.id, item]));

            setItems((prev) => prev
                .filter((item) => !missingIds.has(item.vn.id))
                .map((item) => {
                    const refreshedItem = updatedById.get(item.vn.id);
                    return refreshedItem && refreshedItem.updatedAt >= item.updatedAt
                        ? refreshedItem
                        : item;
                }));
            return updatedItems.length;
        } catch (error) {
            console.error("Failed to refresh NSFW flags:", error);
            throw error;
        }
    }

    function getItem(id: string) {
        return items.find((i) => i.vn.id === id);
    }

    return (
        <LibraryContext.Provider
            value={{
                items,
                purchaseSources,
                isLoading,
                loadError,
                reloadLibrary: () => loadLibrary(true),
                addItem,
                updateItem,
                removeItem,
                getItem,
                addPurchaseSource,
                updatePurchaseSource,
                deletePurchaseSource,
                refreshNSFWFlags,
            }}
        >
            {children}
        </LibraryContext.Provider>
    );
}

export function useLibrary() {
    const context = useContext(LibraryContext);
    if (context === undefined) {
        throw new Error("useLibrary must be used within a LibraryProvider");
    }
    return context;
}
