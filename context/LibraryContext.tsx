"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { LibraryItem, GameStatus } from "@/types/library";
import { VN } from "@/types/vndb";
import * as db from "@/lib/db";

interface LibraryContextType {
    items: LibraryItem[];
    purchaseSources: string[];
    isLoading: boolean;
    addItem: (vn: VN, status: GameStatus, score?: number, notes?: string, playTime?: number, review?: string, purchaseLocation?: string) => Promise<void>;
    updateItem: (item: LibraryItem) => Promise<void>;
    removeItem: (id: string) => Promise<void>;
    getItem: (id: string) => LibraryItem | undefined;
    addPurchaseSource: (name: string) => Promise<void>;
    updatePurchaseSource: (oldName: string, newName: string) => Promise<void>;
    deletePurchaseSource: (name: string) => Promise<void>;
}

const LibraryContext = createContext<LibraryContextType | undefined>(undefined);

export function LibraryProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<LibraryItem[]>([]);
    const [purchaseSources, setPurchaseSources] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadLibrary();
    }, []);

    async function loadLibrary() {
        try {
            const [loadedItems, loadedSources] = await Promise.all([
                db.getAllLibraryItems(),
                db.getAllPurchaseSources()
            ]);
            setItems(loadedItems);
            setPurchaseSources(loadedSources.map(s => s.name));
        } catch (error) {
            console.error("Failed to load library:", error);
        } finally {
            setIsLoading(false);
        }
    }

    async function addItem(vn: VN, status: GameStatus, score: number = 0, notes: string = "", playTime: number = 0, review: string = "", purchaseLocation?: string) {
        const newItem: LibraryItem = {
            vn,
            status,
            score,
            notes,
            playTime,
            review,
            purchaseLocation,
            addedAt: Date.now(),
            updatedAt: Date.now(),
        };
        await db.addToLibrary(newItem);
        setItems((prev) => [...prev, newItem]);
    }

    async function updateItem(item: LibraryItem) {
        const updatedItem = { ...item, updatedAt: Date.now() };
        await db.addToLibrary(updatedItem);
        setItems((prev) =>
            prev.map((i) => (i.vn.id === item.vn.id ? updatedItem : i))
        );
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
        // Also update local items state to reflect the change immediately
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

    function getItem(id: string) {
        return items.find((i) => i.vn.id === id);
    }

    return (
        <LibraryContext.Provider
            value={{ items, purchaseSources, isLoading, addItem, updateItem, removeItem, getItem, addPurchaseSource, updatePurchaseSource, deletePurchaseSource }}
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
