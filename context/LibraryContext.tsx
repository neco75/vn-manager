"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { LibraryItem, GameStatus } from "@/types/library";
import { VN } from "@/types/vndb";
import * as db from "@/lib/db";

interface LibraryContextType {
    items: LibraryItem[];
    isLoading: boolean;
    addItem: (vn: VN, status: GameStatus, score?: number, notes?: string, playTime?: number, review?: string) => Promise<void>;
    updateItem: (item: LibraryItem) => Promise<void>;
    removeItem: (id: string) => Promise<void>;
    getItem: (id: string) => LibraryItem | undefined;
}

const LibraryContext = createContext<LibraryContextType | undefined>(undefined);

export function LibraryProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<LibraryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadLibrary();
    }, []);

    async function loadLibrary() {
        try {
            const loadedItems = await db.getAllLibraryItems();
            setItems(loadedItems);
        } catch (error) {
            console.error("Failed to load library:", error);
        } finally {
            setIsLoading(false);
        }
    }

    async function addItem(vn: VN, status: GameStatus, score: number = 0, notes: string = "", playTime: number = 0, review: string = "") {
        const newItem: LibraryItem = {
            vn,
            status,
            score,
            notes,
            playTime,
            review,
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

    function getItem(id: string) {
        return items.find((i) => i.vn.id === id);
    }

    return (
        <LibraryContext.Provider
            value={{ items, isLoading, addItem, updateItem, removeItem, getItem }}
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
