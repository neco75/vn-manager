import { describe, expect, it } from "vitest";
import { calculateLibraryStatistics } from "@/lib/statistics";
import type { LibraryItem } from "@/types/library";

function makeItem(
    id: string,
    overrides: Partial<LibraryItem> = {},
    vnOverrides: Partial<LibraryItem["vn"]> = {},
): LibraryItem {
    return {
        recordVersion: 2,
        vn: {
            id,
            title: id,
            released: "2020-01-01",
            languages: [],
            platforms: [],
            image: null,
            description: "",
            rating: 0,
            votecount: 0,
            length_minutes: 60,
            tags: [],
            developers: [],
            screenshots: [],
            extlinks: [],
            releases: [],
            ...vnOverrides,
        },
        status: "plan_to_play",
        ownership: "unknown",
        score: null,
        notes: "",
        addedAt: 1,
        updatedAt: 1,
        ...overrides,
    };
}

describe("calculateLibraryStatistics", () => {
    it("keeps recorded and estimated time separate and excludes watched time", () => {
        const stats = calculateLibraryStatistics([
            makeItem("playing", { status: "playing", ownership: "owned", playTime: 0 }, { length_minutes: 60 }),
            makeItem("watched", { status: "watched", playTime: 120 }, { length_minutes: 600 }),
            makeItem("completed", { status: "completed", playTime: 30 }, { length_minutes: 240 }),
            makeItem("planned", { status: "plan_to_play", ownership: "owned" }, { length_minutes: 180 }),
        ]);

        expect(stats.actualPlaytimeMinutes).toBe(30);
        expect(stats.estimatedUnstartedMinutes).toBe(180);
        expect(stats.estimatedUnstartedCount).toBe(1);
    });

    it("includes zero scores in the rated average", () => {
        const stats = calculateLibraryStatistics([
            makeItem("zero", { score: 0 }),
            makeItem("hundred", { score: 100 }),
            makeItem("unrated", { score: null }),
        ]);

        expect(stats.averageScore).toBe(50);
        expect(stats.ratedCount).toBe(2);
    });

    it("groups completed dates by their stored calendar month without timezone conversion", () => {
        const stats = calculateLibraryStatistics([
            makeItem("year-end", { status: "completed", completedOn: "2025-12-31" }),
            makeItem("new-year", { status: "completed", completedOn: "2026-01-01" }),
            makeItem("same-year-end", { status: "completed", completedOn: "2026-12-31" }),
            makeItem("unknown", { status: "completed" }),
        ]);

        expect(stats.monthlyCompleted).toEqual([
            { month: "2025-12", count: 1 },
            { month: "2026-01", count: 1 },
            { month: "2026-12", count: 1 },
        ]);
        expect(stats.completedWithoutDate).toBe(1);
    });

    it("keeps spoiler and unknown tags out of the public frequency aggregation", () => {
        const stats = calculateLibraryStatistics([
            makeItem("one", {}, {
                tags: [
                    { id: "safe", name: "Safe", category: "cont", spoiler: 0 },
                    { id: "spoiler", name: "Spoiler", category: "cont", spoiler: 2 },
                    { id: "unknown", name: "Unknown", category: "cont" },
                ],
            }),
            makeItem("two", {}, {
                tags: [{ id: "safe", name: "Safe", category: "cont", spoiler: 0 }],
            }),
        ]);

        expect(stats.tagFrequencies).toEqual([{ name: "Safe", count: 2 }]);
    });

    it("returns empty, finite values when there are no records", () => {
        const stats = calculateLibraryStatistics([]);

        expect(stats.averageScore).toBeNull();
        expect(stats.actualPlaytimeMinutes).toBe(0);
        expect(stats.estimatedUnstartedMinutes).toBe(0);
        expect(stats.estimatedUnstartedCount).toBe(0);
        expect(stats.monthlyCompleted).toEqual([]);
        expect(stats.tagFrequencies).toEqual([]);
    });
});
