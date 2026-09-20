import { describe, expect, it } from "vitest";
import { LIBRARY_RECORD_VERSION, migrateLibraryRecord } from "@/lib/library-record.mjs";
import { calculateAverageScore, compareLibraryScores } from "@/lib/library-score";

describe("library score and record migration", () => {
    it("keeps an explicitly rated zero separate from an unrated null", () => {
        expect(calculateAverageScore([{ score: 0 }, { score: 100 }, { score: null }])).toBe(50);
        expect(calculateAverageScore([{ score: null }])).toBeNull();
        expect(compareLibraryScores({ score: 0 }, { score: null }, "asc")).toBe(-1);
        expect(compareLibraryScores({ score: null }, { score: 100 }, "desc")).toBe(1);
    });

    it("migrates legacy zero scores to null while preserving current zero scores", () => {
        const legacy = migrateLibraryRecord({
            vn: { id: "v90", title: "Legacy zero" },
            status: "completed",
            score: 0,
            notes: "legacy memo",
            addedAt: 10,
            updatedAt: 20,
        });

        expect(legacy.recordVersion).toBe(LIBRARY_RECORD_VERSION);
        expect(legacy.ownership).toBe("unknown");
        expect(legacy.score).toBeNull();
        expect(migrateLibraryRecord({ ...legacy, vn: { id: "v91", title: "Current zero" }, score: 0 }).score).toBe(0);
    });
});
