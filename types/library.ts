import type { VN } from "./vndb";

export const GAME_STATUSES = [
    "playing",
    "completed",
    "on_hold",
    "dropped",
    "plan_to_play",
    "watched",
] as const;

export const OWNERSHIP_STATUSES = ["unknown", "owned", "wishlist"] as const;
export const LIBRARY_RECORD_VERSION = 2 as const;

export type GameStatus = (typeof GAME_STATUSES)[number];
export type OwnershipStatus = (typeof OWNERSHIP_STATUSES)[number];
export type LibraryValidationField =
    | "status"
    | "ownership"
    | "score"
    | "playTime"
    | "startedOn"
    | "completedOn"
    | "lastPlayedOn"
    | "dateOrder"
    | "resumeNote";

export interface LibraryItem {
    recordVersion: typeof LIBRARY_RECORD_VERSION;
    vn: VN;
    status: GameStatus;
    ownership: OwnershipStatus;
    score: number | null; // null = unrated, 0-100 = rated
    notes: string; // Memo
    review?: string; // Thoughts/Review
    playTime?: number; // In minutes
    purchaseLocation?: string; // Where the game was purchased
    startedOn?: string;
    completedOn?: string;
    lastPlayedOn?: string;
    resumeNote?: string;
    addedAt: number;
    updatedAt: number;
}

type MigratableLibraryItem = Omit<LibraryItem, "recordVersion" | "ownership" | "score"> & {
    recordVersion?: unknown;
    ownership?: unknown;
    score?: unknown;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidLibraryDate(value: unknown): value is string {
    if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    );
}

export function getLibraryValidationError(values: {
    status: unknown;
    ownership: unknown;
    score: unknown;
    playTime?: unknown;
    startedOn?: unknown;
    completedOn?: unknown;
    lastPlayedOn?: unknown;
    resumeNote?: unknown;
}): LibraryValidationField | null {
    if (typeof values.status !== "string" || !GAME_STATUSES.includes(values.status as GameStatus)) {
        return "status";
    }

    if (
        typeof values.ownership !== "string" ||
        !OWNERSHIP_STATUSES.includes(values.ownership as OwnershipStatus)
    ) {
        return "ownership";
    }

    if (
        values.score !== null &&
        (
            typeof values.score !== "number" ||
            !Number.isFinite(values.score) ||
            !Number.isInteger(values.score) ||
            values.score < 0 ||
            values.score > 100
        )
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

    for (const field of ["startedOn", "completedOn", "lastPlayedOn"] as const) {
        const value = values[field];
        if (value !== undefined && !isValidLibraryDate(value)) return field;
    }

    if (
        values.startedOn !== undefined &&
        values.completedOn !== undefined &&
        values.startedOn > values.completedOn
    ) {
        return "dateOrder";
    }

    if (
        values.resumeNote !== undefined &&
        (typeof values.resumeNote !== "string" || values.resumeNote.length > 200)
    ) {
        return "resumeNote";
    }

    return null;
}

export function migrateLibraryItem(item: MigratableLibraryItem): LibraryItem {
    if (item.recordVersion === LIBRARY_RECORD_VERSION) {
        return {
            ...(item as LibraryItem),
            ownership: OWNERSHIP_STATUSES.includes(item.ownership as OwnershipStatus)
                ? item.ownership as OwnershipStatus
                : "unknown",
            score: item.score === null || typeof item.score === "number" ? item.score : null,
        };
    }

    return {
        ...(item as Omit<LibraryItem, "recordVersion" | "ownership" | "score">),
        recordVersion: LIBRARY_RECORD_VERSION,
        ownership: OWNERSHIP_STATUSES.includes(item.ownership as OwnershipStatus)
            ? item.ownership as OwnershipStatus
            : "unknown",
        score: item.score === 0 || item.score === undefined || item.score === null
            ? null
            : item.score as number,
    };
}

export function assertValidLibraryItem(item: LibraryItem): void {
    if (item.recordVersion !== LIBRARY_RECORD_VERSION) {
        throw new Error("Invalid library item: recordVersion");
    }
    const invalidField = getLibraryValidationError(item);
    if (invalidField) {
        throw new Error(`Invalid library item: ${invalidField}`);
    }
}
