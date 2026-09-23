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

    const hasStructurallyValidScore =
        value.score === null ||
        (typeof value.score === "number" && Number.isFinite(value.score));

    return (
        typeof value.status === "string" &&
        GAME_STATUSES.includes(value.status as GameStatus) &&
        typeof value.ownership === "string" &&
        OWNERSHIP_STATUSES.includes(value.ownership as OwnershipStatus) &&
        hasStructurallyValidScore &&
        typeof value.notes === "string" &&
        typeof value.review === "string" &&
        typeof value.playTime === "number" &&
        Number.isFinite(value.playTime) &&
        typeof value.purchaseLocation === "string" &&
        typeof value.startedOn === "string" &&
        typeof value.completedOn === "string" &&
        typeof value.lastPlayedOn === "string" &&
        typeof value.resumeNote === "string"
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

export class DetailDraftReadError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "DetailDraftReadError";
    }
}

export function readDetailDraft(vnId: string): DetailDraft | null {
    if (typeof window === "undefined") return null;

    const raw = window.localStorage.getItem(getDraftKey(vnId));
    if (!raw) return null;

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new DetailDraftReadError("Stored draft is not valid JSON");
    }

    if (!isDetailDraft(parsed, vnId)) {
        throw new DetailDraftReadError("Stored draft has an unsupported or invalid structure");
    }

    return parsed;
}

export function writeDetailDraft(draft: DetailDraft): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(getDraftKey(draft.vnId), JSON.stringify(draft));
}

export function removeDetailDraft(vnId: string): void {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(getDraftKey(vnId));
}
