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
    it("keeps zero scores, excludes null, and gives ties competition ranks", () => {
        const ranked = rankLibraryItems([
            makeItem("older-tie", 100, 20),
            makeItem("newer-tie", 100, 30),
            makeItem("zero", 0, 40),
            makeItem("unrated", null, 10),
        ]);

        expect(ranked.map(({ item }) => item.vn.id)).toEqual(["older-tie", "newer-tie", "zero"]);
        expect(ranked.map(({ rank }) => rank)).toEqual([1, 1, 3]);
    });

    it("keeps the same competition rank across three or more ties", () => {
        const threeWayTopTie = rankLibraryItems([
            makeItem("v1", 100, 10),
            makeItem("v2", 100, 20),
            makeItem("v3", 100, 30),
            makeItem("v4", 80, 40),
        ]);
        expect(threeWayTopTie.map(({ rank }) => rank)).toEqual([1, 1, 1, 4]);

        const middleTie = rankLibraryItems([
            makeItem("v1", 100, 10),
            makeItem("v2", 90, 20),
            makeItem("v3", 90, 30),
            makeItem("v4", 90, 40),
            makeItem("v5", 0, 50),
        ]);
        expect(middleTie.map(({ rank }) => rank)).toEqual([1, 2, 2, 2, 5]);
    });

    it("handles all ties, zero ties, all unrated, and empty input", () => {
        expect(rankLibraryItems([
            makeItem("v1", 50, 10),
            makeItem("v2", 50, 20),
            makeItem("v3", 50, 30),
        ]).map(({ rank }) => rank)).toEqual([1, 1, 1]);

        expect(rankLibraryItems([
            makeItem("v1", 0, 10),
            makeItem("v2", 0, 20),
        ]).map(({ rank }) => rank)).toEqual([1, 1]);

        expect(rankLibraryItems([
            makeItem("v1", null, 10),
            makeItem("v2", null, 20),
        ])).toEqual([]);
        expect(rankLibraryItems([])).toEqual([]);
    });

    it("does not mutate input and preserves the established tie order", () => {
        const items = [
            makeItem("v3", 80, 30),
            makeItem("v1", 80, 10),
            makeItem("v2", 80, 20),
        ];
        const original = [...items];

        const ranked = rankLibraryItems(items);

        expect(items).toEqual(original);
        expect(ranked.map(({ item }) => item.vn.id)).toEqual(["v1", "v2", "v3"]);
    });

    it("uses the VN ID as a final deterministic tie-breaker", () => {
        const ranked = rankLibraryItems([
            makeItem("v2", 80, 1),
            makeItem("v1", 80, 1),
        ]);

        expect(ranked.map(({ item }) => item.vn.id)).toEqual(["v1", "v2"]);
    });
});
