import { describe, expect, it } from "vitest";
import { matchesLibrarySearch } from "@/lib/library-filter";
import type { LibraryItem } from "@/types/library";

function makeItem(overrides: Partial<LibraryItem["vn"]> = {}): LibraryItem {
  return {
    vn: {
      id: "v1",
      title: "Romanized Title",
      alttitle: "原題",
      aliases: ["別名のタイトル"],
      developers: [{ id: "s1", name: "Title Works", original: "タイトルワークス" }],
      ...overrides,
    },
    status: "playing",
    ownership: "owned",
    score: null,
    addedAt: 1,
    updatedAt: 1,
  } as LibraryItem;
}

describe("matchesLibrarySearch", () => {
  it("matches Japanese, aliases, and developer names", () => {
    const item = makeItem();

    expect(matchesLibrarySearch(item, "原題")).toBe(true);
    expect(matchesLibrarySearch(item, "別名のタイトル")).toBe(true);
    expect(matchesLibrarySearch(item, "タイトルワークス")).toBe(true);
  });

  it("normalizes width and case, and requires every query term", () => {
    const item = makeItem();

    expect(matchesLibrarySearch(item, "ｔｉｔｌｅ　ｗｏｒｋｓ")).toBe(true);
    expect(matchesLibrarySearch(item, "title missing")).toBe(false);
    expect(matchesLibrarySearch(item, "   ")).toBe(true);
  });

  it("handles a library-sized collection without changing the matching contract", () => {
    const items = Array.from({ length: 500 }, (_, index) =>
      makeItem({
        id: `v${index}`,
        title: index === 499 ? "Needle Title" : `Title ${index}`,
      }),
    );

    expect(items.filter((item) => matchesLibrarySearch(item, "needle")).map((item) => item.vn.id)).toEqual([
      "v499",
    ]);
  });
});
