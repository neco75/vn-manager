import { describe, expect, it } from "vitest";
import {
    BACKUP_SCHEMA_VERSION,
    BackupValidationError,
    parseBackup,
} from "@/lib/backup";

function makeBackup(vnOverrides: Record<string, unknown> = {}) {
    return {
        schemaVersion: BACKUP_SCHEMA_VERSION,
        exportedAt: "2026-09-22T00:00:00.000Z",
        library: [{
            recordVersion: 2,
            vn: {
                id: "v1",
                title: "Example",
                titles: [
                    { lang: "ja", title: "例", latin: null },
                    { lang: "en", title: "Example", latin: "Example" },
                ],
                aliases: ["Alias"],
                alttitle: null,
                olang: "ja",
                ...vnOverrides,
            },
            status: "completed",
            ownership: "owned",
            score: 80,
            notes: "memo",
            addedAt: 100,
            updatedAt: 200,
        }],
        purchaseSources: [],
        settings: {
            language: "ja",
            backgroundImage: null,
            nsfwBlur: true,
        },
    };
}

function expectPath(overrides: Record<string, unknown>, path: RegExp) {
    expect(() => parseBackup(makeBackup(overrides))).toThrowError(
        expect.objectContaining({
            name: "BackupValidationError",
            message: expect.stringMatching(path),
        }),
    );
}

describe("backup VN title metadata validation", () => {
    it("accepts valid title metadata and optional omissions", () => {
        expect(parseBackup(makeBackup()).library[0].vn.titles).toHaveLength(2);
        expect(parseBackup(makeBackup({
            titles: undefined,
            aliases: undefined,
            alttitle: undefined,
            olang: undefined,
        })).library).toHaveLength(1);
    });

    it.each([
        ["object titles", { titles: { ja: "bad" } }, /library\[0\]\.vn\.titles/],
        ["string titles", { titles: "bad" }, /library\[0\]\.vn\.titles/],
        ["null title entry", { titles: [null] }, /library\[0\]\.vn\.titles\[0\]/],
        ["invalid title lang", { titles: [{ lang: 1, title: "Example" }] }, /library\[0\]\.vn\.titles\[0\]\.lang/],
        ["invalid title text", { titles: [{ lang: "en", title: 1 }] }, /library\[0\]\.vn\.titles\[0\]\.title/],
        ["invalid title latin", { titles: [{ lang: "en", title: "Example", latin: 1 }] }, /library\[0\]\.vn\.titles\[0\]\.latin/],
        ["non-array aliases", { aliases: "Alias" }, /library\[0\]\.vn\.aliases/],
        ["non-string alias", { aliases: ["ok", 1] }, /library\[0\]\.vn\.aliases\[1\]/],
        ["invalid alttitle", { alttitle: 1 }, /library\[0\]\.vn\.alttitle/],
        ["invalid olang", { olang: { code: "ja" } }, /library\[0\]\.vn\.olang/],
    ])("rejects %s with its exact path", (_name, overrides, path) => {
        expectPath(overrides as Record<string, unknown>, path as RegExp);
    });

    it("still accepts legacy array and schemaVersion 1 when optional title fields are absent", () => {
        const current = makeBackup({ titles: undefined, aliases: undefined, alttitle: undefined, olang: undefined });
        const legacyItem = {
            ...(current.library[0] as Record<string, unknown>),
        };
        delete legacyItem.recordVersion;
        delete legacyItem.ownership;

        expect(parseBackup([legacyItem]).legacy).toBe(true);
        expect(parseBackup({ ...current, schemaVersion: 1, library: [legacyItem] }).schemaVersion).toBe(1);
    });

    it("uses BackupValidationError for invalid title metadata", () => {
        expect(() => parseBackup(makeBackup({ titles: {} }))).toThrow(BackupValidationError);
    });
});
