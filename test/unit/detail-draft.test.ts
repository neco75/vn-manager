import { afterEach, describe, expect, it } from "vitest";
import {
    DetailDraftReadError,
    readDetailDraft,
    removeDetailDraft,
    writeDetailDraft,
    type DetailDraft,
} from "@/lib/detail-draft";

const draft: DetailDraft = {
    version: 1,
    vnId: "v1",
    baseUpdatedAt: 10,
    updatedAt: 20,
    values: {
        status: "playing",
        ownership: "owned",
        score: 80,
        notes: "memo",
        review: "review",
        playTime: 12.5,
        purchaseLocation: "store",
        startedOn: "2026-01-01",
        completedOn: "",
        lastPlayedOn: "2026-01-02",
        resumeNote: "continue",
    },
};

describe("detail draft storage", () => {
    afterEach(() => {
        localStorage.clear();
    });

    it("round-trips a draft for the same VN", () => {
        writeDetailDraft(draft);

        expect(readDetailDraft("v1")).toEqual(draft);
    });

    it("keeps drafts isolated by VN id", () => {
        writeDetailDraft(draft);

        expect(readDetailDraft("v2")).toBeNull();
    });

    it("removes only the requested draft", () => {
        writeDetailDraft(draft);
        writeDetailDraft({ ...draft, vnId: "v2" });

        removeDetailDraft("v1");

        expect(readDetailDraft("v1")).toBeNull();
        expect(readDetailDraft("v2")).not.toBeNull();
    });

    it.each([
        ["score 101", { score: 101 }],
        ["score -1", { score: -1 }],
        ["fractional score", { score: 80.5 }],
        ["negative play time", { playTime: -60 }],
    ])("restores in-progress values outside save validation: %s", (_label, override) => {
        const inProgress = {
            ...draft,
            values: {
                ...draft.values,
                ...override,
                notes: "keep this memo",
                review: "keep this review",
            },
        };
        writeDetailDraft(inProgress);

        expect(readDetailDraft("v1")).toEqual(inProgress);
    });

    it("reports malformed stored data instead of silently ignoring it", () => {
        localStorage.setItem("vn-manager-detail-draft-v1:v1", "not-json");

        expect(() => readDetailDraft("v1")).toThrow(DetailDraftReadError);
    });

    it("reports drafts from a different storage version instead of silently ignoring them", () => {
        localStorage.setItem(
            "vn-manager-detail-draft-v1:v1",
            JSON.stringify({ ...draft, version: 99 }),
        );

        expect(() => readDetailDraft("v1")).toThrow(DetailDraftReadError);
    });

    it("still rejects structurally invalid field types", () => {
        localStorage.setItem(
            "vn-manager-detail-draft-v1:v1",
            JSON.stringify({
                ...draft,
                values: { ...draft.values, score: "101" },
            }),
        );

        expect(() => readDetailDraft("v1")).toThrow(DetailDraftReadError);
    });
});
