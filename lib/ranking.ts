import type { LibraryItem } from "@/types/library";

export interface RankedLibraryItem {
    item: LibraryItem;
    rank: number;
}

function compareTies(left: LibraryItem, right: LibraryItem): number {
    const addedAtDifference = left.addedAt - right.addedAt;
    if (addedAtDifference !== 0) return addedAtDifference;

    const updatedAtDifference = left.updatedAt - right.updatedAt;
    if (updatedAtDifference !== 0) return updatedAtDifference;

    return left.vn.id < right.vn.id ? -1 : left.vn.id > right.vn.id ? 1 : 0;
}

export function rankLibraryItems(items: readonly LibraryItem[]): RankedLibraryItem[] {
    const sorted = items
        .filter((item) => item.score !== null)
        .map((item, index) => ({ item, index }))
        .sort((left, right) => {
            const scoreDifference = (right.item.score ?? 0) - (left.item.score ?? 0);
            return scoreDifference || compareTies(left.item, right.item) || left.index - right.index;
        });

    return sorted.map(({ item }, index) => ({
        item,
        rank: index === 0 || item.score !== sorted[index - 1].item.score
            ? index + 1
            : 0,
    })).map((entry, index, ranked) => ({
        ...entry,
        rank: entry.rank || ranked[index - 1].rank,
    }));
}
