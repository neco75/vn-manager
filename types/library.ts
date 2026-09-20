import type { VN } from "./vndb";
import {
    LIBRARY_RECORD_VERSION,
    OWNERSHIP_STATUSES,
    isValidLibraryDate,
} from "../lib/library-record.mjs";

export { LIBRARY_RECORD_VERSION, OWNERSHIP_STATUSES, isValidLibraryDate };

export const GAME_STATUSES = [
    "playing",
    "completed",
    "on_hold",
    "dropped",
    "plan_to_play",
    "watched",
] as const;

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
    score: number | null;
    notes: string;
    review?: string;
    playTime?: number;
    purchaseLocation?: string;
    startedOn?: string;
    completedOn?: string;
    lastPlayedOn?: string;
    resumeNote?: string;
    addedAt: number;
    updatedAt: number;
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

export function assertValidLibraryItem(item: LibraryItem): void {
    if (item.recordVersion !== LIBRARY_RECORD_VERSION) {
        throw new Error("Invalid library item: recordVersion");
    }
    const invalidField = getLibraryValidationError(item);
    if (invalidField) {
        throw new Error(`Invalid library item: ${invalidField}`);
    }
}
