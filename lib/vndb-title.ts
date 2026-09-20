import type { VNTitleFields } from "@/types/vndb";

export type DisplayLanguage = "ja" | "en";

function firstNonEmpty(values: Array<string | null | undefined>): string | null {
    return values.find((value) => typeof value === "string" && value.trim().length > 0)?.trim() ?? null;
}

export function getDisplayTitle(vn: VNTitleFields, language: DisplayLanguage): string {
    if (language === "ja") {
        return firstNonEmpty([
            vn.titles?.find((title) => title.lang === "ja")?.title,
            vn.alttitle,
            vn.title,
        ]) ?? "";
    }

    return firstNonEmpty([
        vn.titles?.find((title) => title.lang === "en")?.title,
        vn.title,
    ]) ?? "";
}

export function getTitleSearchTerms(vn: VNTitleFields): string[] {
    const values = [
        vn.title,
        vn.alttitle,
        ...(vn.titles ?? []).flatMap((title) => [title.title, title.latin]),
        ...(vn.aliases ?? []),
    ];

    return [...new Set(values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean))];
}
