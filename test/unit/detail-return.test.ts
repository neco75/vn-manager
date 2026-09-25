import { describe, expect, it } from "vitest";
import { getSafeDetailReturnPath } from "@/lib/detail-return";

describe("detail return paths", () => {
    it("allows the library root, filtered library URLs, and search queries", () => {
        expect(getSafeDetailReturnPath(["/"])).toBe("/");
        expect(getSafeDetailReturnPath([
            "/?q=Title+Works&status=playing&ownership=unknown&sort=score_asc&view=list",
        ])).toBe("/?q=Title+Works&status=playing&ownership=unknown&sort=score_asc&view=list");
        expect(getSafeDetailReturnPath(["/search?q=CLANNAD"])).toBe("/search?q=CLANNAD");
        expect(getSafeDetailReturnPath(["/search?q=title%20%26%20subtitle"])).toBe(
            "/search?q=title%20%26%20subtitle",
        );
    });

    it.each([
        "//evil.example",
        "https://evil.example/path",
        "/\\evil.example",
        "/vn/v1",
        "/search",
        "/search?q=",
        "/search?q=ok&next=/",
        "/search?q=%ZZ",
        "/?status=not-a-status",
        "/?q=ok&q=attacker",
        "/?unknown=1",
        "/%2f%2fevil.example",
    ])("rejects unsupported or malformed target %s", (target) => {
        expect(getSafeDetailReturnPath([target])).toBe("/");
    });

    it("rejects missing or ambiguous from parameters", () => {
        expect(getSafeDetailReturnPath([])).toBe("/");
        expect(getSafeDetailReturnPath(["/search?q=ok", "/?status=playing"])).toBe("/");
    });
});
