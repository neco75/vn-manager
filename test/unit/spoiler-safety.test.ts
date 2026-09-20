import { describe, expect, it } from "vitest";
import {
    getHiddenTags,
    getVisibleSynopsisText,
    getVisibleTags,
    parseSynopsis,
} from "@/lib/spoiler-safety";

describe("spoiler safety", () => {
    it("only shows tags explicitly marked as non-spoilers", () => {
        const tags = [
            { name: "safe", spoiler: 0 },
            { name: "light", spoiler: 1 },
            { name: "heavy", spoiler: 2 },
            { name: "unknown" },
        ];

        expect(getVisibleTags(tags).map((tag) => tag.name)).toEqual(["safe"]);
        expect(getHiddenTags(tags).map((tag) => tag.name)).toEqual(["light", "heavy", "unknown"]);
    });

    it("keeps single and multiple spoiler sections hidden", () => {
        expect(parseSynopsis("before [spoiler]one[/spoiler] after")).toEqual([
            { kind: "text", text: "before " },
            { kind: "spoiler", text: "one" },
            { kind: "text", text: " after" },
        ]);

        expect(getVisibleSynopsisText("[spoiler]one[/spoiler] visible [spoiler]two[/spoiler]")).toBe(" visible ");
    });

    it("hides malformed spoiler input instead of leaking its contents", () => {
        expect(getVisibleSynopsisText("safe [spoiler]secret")).toBe("safe ");
        expect(getVisibleSynopsisText("safe [spoiler secret")).toBe("safe ");
    });
});
