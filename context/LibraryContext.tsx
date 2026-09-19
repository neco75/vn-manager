"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { LibraryItem, GameStatus } from "@/types/library";
import { VN } from "@/types/vndb";
import * as db from "@/lib/db";
import { createLibraryItemForAdd, upsertLibraryItem } from "@/lib/library-state";

interface LibraryContextType {
    items: LibraryItem[];
    purchaseSources: string[];
    isLoading: boolean;
    loadError: boolean;
    reloadLibrary: () => Promise<void>;
    addItem: (vn: VN, status: GameStatus, score?: number, notes?: string, playTime?: number, review?: string, purchaseLocation?: string) => Promise<void>;
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
        loadLibrary();
    }, []);

    async function loadLibrary() {
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
        } finally {
            setIsLoading(false);
        }
    }

    async function addItem(vn: VN, status: GameStatus, score: number = 0, notes: string = "", playTime: number = 0, review: string = "", purchaseLocation?: string) {
        const existingItem = await db.getLibraryItem(vn.id);
        const newItem = createLibraryItemForAdd(existingItem, {
            vn,
            status,
            score,
            notes,
            playTime,
            review,
            purchaseLocation,
        });
        await db.addToLibrary(newItem);
        setItems((prev) => upsertLibraryItem(prev, newItem));
    }

    async function updateItem(item: LibraryItem) {
        const updatedItem = { ...item, updatedAt: Date.now() };
        await db.addToLibrary(updatedItem);
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
        await db.updatePurchaseSource(oldName, newName);
        setPurchaseSources(prev => prev.map(s => s === oldName ? newName : s));
        setItems(prev => prev.map(item => {
            if (item.purchaseLocation === oldName) {
                return { ...item, purchaseLocation: newName, updatedAt: Date.now() };
            }
            return item;
        }));
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
            const updatedItems = items.map(item => {
                const updatedVN = updatedVNs.find(v => v.id === item.vn.id);
                if (updatedVN) {
                    return { ...item, vn: updatedVN, updatedAt: Date.now() };
                }
                return item;
            });

            await Promise.all(updatedItems.map(item => db.addToLibrary(item)));
            setItems(updatedItems);
            return updatedVNs.length;
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
                reloadLibrary: loadLibrary,
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
