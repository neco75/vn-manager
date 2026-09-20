import { describe, expect, it } from "vitest";
import { isValidImageSexualValue, shouldBlurImage } from "@/lib/image-safety";

describe("image safety", () => {
    it.each([
        [0, false],
        [0.5, false],
        [1, true],
        [1.5, true],
        [2, true],
        [undefined, true],
        [null, true],
        ["1", true],
    ])("blur is safe by default for sexual=%s", (sexual, expected) => {
        expect(shouldBlurImage(sexual, true)).toBe(expected);
    });

    it.each([0, 0.5, 1, 1.5, 2, undefined, null])(
        "does not blur when the setting is off (sexual=%s)",
        (sexual) => {
            expect(shouldBlurImage(sexual, false)).toBe(false);
        },
    );

    it("accepts only finite values in the VNDB range", () => {
        expect(isValidImageSexualValue(0)).toBe(true);
        expect(isValidImageSexualValue(2)).toBe(true);
        expect(isValidImageSexualValue(-1)).toBe(false);
        expect(isValidImageSexualValue(3)).toBe(false);
        expect(isValidImageSexualValue(Number.NaN)).toBe(false);
    });
});
