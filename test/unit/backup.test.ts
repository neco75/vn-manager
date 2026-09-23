import { describe, expect, it } from "vitest";
import { parseBackup } from "@/lib/backup";

const backup = {
    schemaVersion: 2,
    exportedAt: "2026-09-20T00:00:00.000Z",
    library: [{
        recordVersion: 2,
        vn: { id: "v1", title: "Example", titles: { ja: "invalid" } },
        status: "plan_to_play",
        ownership: "unknown",
        score: null,
        notes: "",
        addedAt: 1,
        updatedAt: 1,
    }],
    purchaseSources: [],
    settings: { language: "ja", backgroundImage: null, nsfwBlur: true },
};

const validBackup = {
    ...backup,
    library: [{
        ...backup.library[0],
        vn: {
            id: "v1",
            title: "Example",
            alttitle: null,
            titles: [{ lang: "ja", title: "Example", latin: null, official: true, main: true }],
            aliases: ["Alias"],
            olang: "ja",
        },
    }],
};

describe("backup VN validation", () => {
    it("rejects a non-array titles field at its input path", () => {
        expect(() => parseBackup(backup)).toThrowError("library[0].vn.titles: must be an array");
    });

    it("accepts the optional VN title fields with their stored shapes", () => {
        expect(parseBackup(validBackup).library[0].vn).toEqual(validBackup.library[0].vn);
    });

    it("rejects malformed VN title fields at their input paths", () => {
        const invalidFields = [
            [{ titles: [null] }, "library[0].vn.titles[0]: must be an object"],
            [{ titles: [{ lang: 1, title: "Example" }] }, "library[0].vn.titles[0].lang: must be a non-empty string"],
            [{ titles: [{ lang: "ja", title: 1 }] }, "library[0].vn.titles[0].title: must be a non-empty string"],
            [{ titles: [{ lang: "ja", title: "Example", latin: 1 }] }, "library[0].vn.titles[0].latin: must be a string or null"],
            [{ titles: [{ lang: "ja", title: "Example", official: "yes" }] }, "library[0].vn.titles[0].official: must be a boolean"],
            [{ aliases: "Alias" }, "library[0].vn.aliases: must be an array"],
            [{ aliases: [1] }, "library[0].vn.aliases[0]: must be a string"],
            [{ alttitle: 1 }, "library[0].vn.alttitle: must be a string or null"],
            [{ olang: [] }, "library[0].vn.olang: must be a string or null"],
        ] as const;

        for (const [changes, message] of invalidFields) {
            const invalidBackup = {
                ...validBackup,
                library: [{
                    ...validBackup.library[0],
                    vn: { ...validBackup.library[0].vn, ...changes },
                }],
            };
            expect(() => parseBackup(invalidBackup)).toThrowError(message);
        }
    });
});
