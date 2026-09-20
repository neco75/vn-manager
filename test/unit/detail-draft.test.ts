import { afterEach, describe, expect, it } from "vitest";
import {
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

    it("ignores malformed stored data", () => {
        localStorage.setItem("vn-manager-detail-draft-v1:v1", "not-json");

        expect(readDetailDraft("v1")).toBeNull();
    });

    it("ignores drafts from a different storage version", () => {
        localStorage.setItem(
            "vn-manager-detail-draft-v1:v1",
            JSON.stringify({ ...draft, version: 99 }),
        );

        expect(readDetailDraft("v1")).toBeNull();
    });
});
