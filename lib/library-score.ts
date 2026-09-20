import type { LibraryItem } from "../types/library";

export function calculateAverageScore(
    items: Array<Pick<LibraryItem, "score">>,
): number | null {
    const ratedScores = items
        .map((item) => item.score)
        .filter((score): score is number => score !== null);

    if (ratedScores.length === 0) return null;
    return ratedScores.reduce((sum, score) => sum + score, 0) / ratedScores.length;
}

export function compareLibraryScores(
    left: Pick<LibraryItem, "score">,
    right: Pick<LibraryItem, "score">,
    direction: "asc" | "desc",
): number {
    if (left.score === null) return right.score === null ? 0 : 1;
    if (right.score === null) return -1;
    return direction === "asc"
        ? left.score - right.score
        : right.score - left.score;
}
