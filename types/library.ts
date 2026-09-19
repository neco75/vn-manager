import type { VN } from "./vndb";

export const GAME_STATUSES = [
    "playing",
    "completed",
    "on_hold",
    "dropped",
    "plan_to_play",
    "watched",
] as const;

export type GameStatus = (typeof GAME_STATUSES)[number];
export type LibraryValidationField = "status" | "score" | "playTime";

export interface LibraryItem {
    vn: VN;
    status: GameStatus;
    score: number; // 0-100
    notes: string; // Memo
    review?: string; // Thoughts/Review
    playTime?: number; // In minutes
    purchaseLocation?: string; // Where the game was purchased
    addedAt: number;
    updatedAt: number;
}

export function getLibraryValidationError(values: {
    status: unknown;
    score: unknown;
    playTime?: unknown;
}): LibraryValidationField | null {
    if (typeof values.status !== "string" || !GAME_STATUSES.includes(values.status as GameStatus)) {
        return "status";
    }

    if (
        typeof values.score !== "number" ||
        !Number.isFinite(values.score) ||
        !Number.isInteger(values.score) ||
        values.score < 0 ||
        values.score > 100
    ) {
        return "score";
    }

    if (
        values.playTime !== undefined &&
        (
            typeof values.playTime !== "number" ||
            !Number.isFinite(values.playTime) ||
            values.playTime < 0
        )
    ) {
        return "playTime";
    }

    return null;
}

export function assertValidLibraryItem(item: LibraryItem): void {
    const invalidField = getLibraryValidationError(item);
    if (invalidField) {
        throw new Error(`Invalid library item: ${invalidField}`);
    }
}
