import type { VN } from "./vndb";
import { LIBRARY_RECORD_VERSION, OWNERSHIP_STATUSES, isValidLibraryDate } from "../lib/library-record.mjs";

export { LIBRARY_RECORD_VERSION, OWNERSHIP_STATUSES, isValidLibraryDate };

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

export function assertValidLibraryItem(item: LibraryItem): void {
    if (item.recordVersion !== LIBRARY_RECORD_VERSION) {
        throw new Error("Invalid library item: recordVersion");
    }
    const invalidField = getLibraryValidationError(item);
    if (invalidField) {
        throw new Error(`Invalid library item: ${invalidField}`);
    }
}
