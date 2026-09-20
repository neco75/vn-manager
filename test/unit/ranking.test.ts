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

    it("uses the VN ID as a final deterministic tie-breaker", () => {
        const ranked = rankLibraryItems([
            makeItem("v2", 80, 1),
            makeItem("v1", 80, 1),
        ]);

        expect(ranked.map(({ item }) => item.vn.id)).toEqual(["v1", "v2"]);
    });
});
