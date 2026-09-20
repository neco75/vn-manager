import { describe, expect, it } from "vitest";
import { getDisplayTitle, getTitleSearchTerms } from "@/lib/vndb-title";

describe("VN title selection", () => {
    const localizedVN = {
        title: "Romanized title",
        alttitle: "原語の代替タイトル",
        titles: [
            { lang: "ja", title: "日本語タイトル", latin: "Japanese title" },
            { lang: "en", title: "English title", latin: null },
        ],
        aliases: ["別名", "Alias"],
    };

    it("prefers Japanese and English titles for the corresponding UI language", () => {
        expect(getDisplayTitle(localizedVN, "ja")).toBe("日本語タイトル");
        expect(getDisplayTitle(localizedVN, "en")).toBe("English title");
    });

    it("falls back to the alternative title and then the existing title in Japanese", () => {
        expect(getDisplayTitle({ title: "Romanized title", alttitle: "原語の代替タイトル" }, "ja")).toBe("原語の代替タイトル");
        expect(getDisplayTitle({ title: "Romanized title" }, "ja")).toBe("Romanized title");
    });

    it("collects title, romanized title, and aliases for later local search", () => {
        expect(getTitleSearchTerms(localizedVN)).toEqual([
            "Romanized title",
            "原語の代替タイトル",
            "日本語タイトル",
            "Japanese title",
            "English title",
            "別名",
            "Alias",
        ]);
    });
});
