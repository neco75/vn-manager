import {
    GAME_STATUSES,
    OWNERSHIP_STATUSES,
    type GameStatus,
    type OwnershipStatus,
} from "../types/library";

export const DETAIL_DRAFT_VERSION = 1 as const;

export interface DetailDraftValues {
    status: GameStatus;
    ownership: OwnershipStatus;
    score: number | null;
    notes: string;
    review: string;
    playTime: number;
    purchaseLocation: string;
    startedOn: string;
    completedOn: string;
    lastPlayedOn: string;
    resumeNote: string;
}

export interface DetailDraft {
    version: typeof DETAIL_DRAFT_VERSION;
    vnId: string;
    baseUpdatedAt: number | null;
    updatedAt: number;
    values: DetailDraftValues;
}

function getDraftKey(vnId: string): string {
    return `vn-manager-detail-draft-v${DETAIL_DRAFT_VERSION}:${encodeURIComponent(vnId)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function isDetailDraftValues(value: unknown): value is DetailDraftValues {
    if (!isRecord(value)) return false;

    const hasValidScore =
        value.score === null ||
        (
            typeof value.score === "number" &&
            Number.isFinite(value.score) &&
            Number.isInteger(value.score) &&
            value.score >= 0 &&
            value.score <= 100
        );

    return (
        typeof value.status === "string" &&
        GAME_STATUSES.includes(value.status as GameStatus) &&
        typeof value.ownership === "string" &&
        OWNERSHIP_STATUSES.includes(value.ownership as OwnershipStatus) &&
        hasValidScore &&
        typeof value.notes === "string" &&
        typeof value.review === "string" &&
        typeof value.playTime === "number" &&
        Number.isFinite(value.playTime) &&
        value.playTime >= 0 &&
        typeof value.purchaseLocation === "string" &&
        typeof value.startedOn === "string" &&
        typeof value.completedOn === "string" &&
        typeof value.lastPlayedOn === "string" &&
        typeof value.resumeNote === "string" &&
        value.resumeNote.length <= 200
    );
}

function isDetailDraft(value: unknown, vnId: string): value is DetailDraft {
    if (!isRecord(value)) return false;

    return (
        value.version === DETAIL_DRAFT_VERSION &&
        value.vnId === vnId &&
        (value.baseUpdatedAt === null ||
            (typeof value.baseUpdatedAt === "number" && Number.isFinite(value.baseUpdatedAt))) &&
        typeof value.updatedAt === "number" &&
        Number.isFinite(value.updatedAt) &&
        isDetailDraftValues(value.values)
    );
}

export function readDetailDraft(vnId: string): DetailDraft | null {
    if (typeof window === "undefined") return null;

    const raw = window.localStorage.getItem(getDraftKey(vnId));
    if (!raw) return null;

    try {
        const parsed: unknown = JSON.parse(raw);
        return isDetailDraft(parsed, vnId) ? parsed : null;
    } catch {
        return null;
    }
}

export function writeDetailDraft(draft: DetailDraft): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(getDraftKey(draft.vnId), JSON.stringify(draft));
}

export function removeDetailDraft(vnId: string): void {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(getDraftKey(vnId));
}
