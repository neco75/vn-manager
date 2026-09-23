import { describe, expect, it } from "vitest";
import { rankLibraryItems } from "@/lib/ranking";
import type { LibraryItem } from "@/types/library";

function makeItem(id: string, score: number | null, addedAt: number): LibraryItem {
    return {
        recordVersion: 2,
        vn: { id, title: id } as LibraryItem["vn"],
        status: "completed",
        ownership: "owned",
        score,
        notes: "",
        addedAt,
        updatedAt: addedAt,
    };
}

describe("rankLibraryItems", () => {
    it("assigns the same rank to a three-way tie and skips following ranks", () => {
        const ranked = rankLibraryItems([
            makeItem("tie-1", 100, 20),
            makeItem("tie-2", 100, 30),
            makeItem("tie-3", 100, 40),
            makeItem("lower", 80, 50),
        ]);

        expect(ranked.map(({ item }) => item.vn.id)).toEqual(["tie-1", "tie-2", "tie-3", "lower"]);
        expect(ranked.map(({ rank }) => rank)).toEqual([1, 1, 1, 4]);
    });

    it("keeps competition ranks after a three-way middle tie and includes zero", () => {
        const ranked = rankLibraryItems([
            makeItem("top", 100, 20),
            makeItem("tie-1", 90, 30),
            makeItem("tie-2", 90, 40),
            makeItem("tie-3", 90, 50),
            makeItem("zero", 0, 60),
        ]);

        expect(ranked.map(({ rank }) => rank)).toEqual([1, 2, 2, 2, 5]);
    });

    it("handles all ties, unrated items, zero ties, and an empty list", () => {
        expect(rankLibraryItems([
            makeItem("tie-1", 70, 20),
            makeItem("tie-2", 70, 30),
            makeItem("tie-3", 70, 40),
        ]).map(({ rank }) => rank)).toEqual([1, 1, 1]);

        expect(rankLibraryItems([
            makeItem("unrated-1", null, 20),
            makeItem("unrated-2", null, 30),
        ])).toEqual([]);

        expect(rankLibraryItems([
            makeItem("zero-1", 0, 20),
            makeItem("zero-2", 0, 30),
        ]).map(({ rank }) => rank)).toEqual([1, 1]);

        expect(rankLibraryItems([])).toEqual([]);
    });

    it("uses the VN ID as a final deterministic tie-breaker without mutating input", () => {
        const items = [
            makeItem("v2", 80, 1),
            makeItem("v1", 80, 1),
        ];
        const originalItems = [...items];
        const ranked = rankLibraryItems(items);

        expect(ranked.map(({ item }) => item.vn.id)).toEqual(["v1", "v2"]);
        expect(items).toEqual(originalItems);
    });
});
