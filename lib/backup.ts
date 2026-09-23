import type { LibraryItem } from "../types/library";
import {
    LIBRARY_RECORD_VERSION,
    OWNERSHIP_STATUSES,
    isValidLibraryDate,
    migrateLibraryRecord,
} from "./library-record.mjs";

export const BACKUP_SCHEMA_VERSION = 2;
const PREVIOUS_BACKUP_SCHEMA_VERSION = 1;

export interface BackupSettings {
    language: "ja" | "en";
    backgroundImage: string | null;
    nsfwBlur: boolean;
}

export interface BackupDocument {
    schemaVersion: typeof BACKUP_SCHEMA_VERSION;
    exportedAt: string;
    library: LibraryItem[];
    purchaseSources: string[];
    settings: BackupSettings;
}

export interface ParsedBackup {
    schemaVersion: 0 | typeof PREVIOUS_BACKUP_SCHEMA_VERSION | typeof BACKUP_SCHEMA_VERSION;
    exportedAt: string | null;
    library: LibraryItem[];
    purchaseSources?: string[];
    settings?: BackupSettings;
    legacy: boolean;
}

export interface RestorePreview {
    total: number;
    additions: number;
    conflicts: number;
}

export interface RestoreLibraryPlan {
    itemsToWrite: LibraryItem[];
    additions: number;
    overwritten: number;
    skippedConflicts: number;
}

export class BackupValidationError extends Error {
    constructor(path: string, message: string) {
        super(`${path}: ${message}`);
        this.name = "BackupValidationError";
    }
}

const VN_ID_PATTERN = /^v[1-9]\d*$/;
const IMAGE_HOSTS = new Set(["t.vndb.org"]);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertString(value: unknown, path: string, { nonEmpty = false } = {}): asserts value is string {
    if (typeof value !== "string" || (nonEmpty && value.trim().length === 0)) {
        throw new BackupValidationError(path, nonEmpty ? "must be a non-empty string" : "must be a string");
    }
}

function assertOptionalString(value: unknown, path: string): void {
    if (value !== undefined && typeof value !== "string") {
        throw new BackupValidationError(path, "must be a string");
    }
}

function assertNullableString(value: unknown, path: string): void {
    if (value !== undefined && value !== null && typeof value !== "string") {
        throw new BackupValidationError(path, "must be a string or null");
    }
}

function assertOptionalBoolean(value: unknown, path: string): void {
    if (value !== undefined && typeof value !== "boolean") {
        throw new BackupValidationError(path, "must be a boolean");
    }
}

function assertFiniteNumber(value: unknown, path: string, options?: { min?: number; max?: number; integer?: boolean }): asserts value is number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new BackupValidationError(path, "must be a finite number");
    }
    if (options?.integer && !Number.isInteger(value)) {
        throw new BackupValidationError(path, "must be an integer");
    }
    if (options?.min !== undefined && value < options.min) {
        throw new BackupValidationError(path, `must be at least ${options.min}`);
    }
    if (options?.max !== undefined && value > options.max) {
        throw new BackupValidationError(path, `must be at most ${options.max}`);
    }
}

function assertStringArray(value: unknown, path: string): void {
    if (!Array.isArray(value)) {
        throw new BackupValidationError(path, "must be an array");
    }
    value.forEach((entry, index) => assertString(entry, `${path}[${index}]`));
}

function parseUrl(value: unknown, path: string, image = false): string {
    assertString(value, path, { nonEmpty: true });
    let parsed: URL;
    try {
        parsed = new URL(value);
    } catch {
        throw new BackupValidationError(path, "must be a valid URL");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new BackupValidationError(path, "must use http or https");
    }
    if (image && (parsed.protocol !== "https:" || !IMAGE_HOSTS.has(parsed.hostname))) {
        throw new BackupValidationError(path, "must use an allowed image host");
    }
    return value;
}

function assertVnId(value: unknown, path: string): asserts value is string {
    assertString(value, path, { nonEmpty: true });
    if (!VN_ID_PATTERN.test(value)) {
        throw new BackupValidationError(path, "must be a VNDB VN id such as v123");
    }
}

function validateImage(value: unknown, path: string): void {
    if (value === undefined || value === null) return;
    if (!isRecord(value)) throw new BackupValidationError(path, "must be an object or null");

    parseUrl(value.url, `${path}.url`, true);

    if (value.dims !== undefined) {
        if (!Array.isArray(value.dims) || value.dims.length !== 2) {
            throw new BackupValidationError(`${path}.dims`, "must contain width and height");
        }
        assertFiniteNumber(value.dims[0], `${path}.dims[0]`, { min: 0 });
        assertFiniteNumber(value.dims[1], `${path}.dims[1]`, { min: 0 });
    }
    if (value.sexual !== undefined) assertFiniteNumber(value.sexual, `${path}.sexual`, { min: 0, max: 2 });
    if (value.violence !== undefined) assertFiniteNumber(value.violence, `${path}.violence`, { min: 0, max: 2 });
}

function validateVNTitle(value: unknown, path: string): void {
    if (!isRecord(value)) throw new BackupValidationError(path, "must be an object");

    assertString(value.lang, `${path}.lang`, { nonEmpty: true });
    assertString(value.title, `${path}.title`, { nonEmpty: true });
    assertNullableString(value.latin, `${path}.latin`);
    assertOptionalBoolean(value.official, `${path}.official`);
    assertOptionalBoolean(value.main, `${path}.main`);
}

function validateVN(value: unknown, path: string): void {
    if (!isRecord(value)) throw new BackupValidationError(path, "must be an object");

    assertVnId(value.id, `${path}.id`);
    assertString(value.title, `${path}.title`, { nonEmpty: true });
    assertNullableString(value.alttitle, `${path}.alttitle`);
    if (value.titles !== undefined) {
        if (!Array.isArray(value.titles)) throw new BackupValidationError(`${path}.titles`, "must be an array");
        value.titles.forEach((title, index) => validateVNTitle(title, `${path}.titles[${index}]`));
    }
    if (value.aliases !== undefined) assertStringArray(value.aliases, `${path}.aliases`);
    assertNullableString(value.olang, `${path}.olang`);

    if (value.released !== undefined && value.released !== null) assertString(value.released, `${path}.released`);
    if (value.languages !== undefined) assertStringArray(value.languages, `${path}.languages`);
    if (value.platforms !== undefined) assertStringArray(value.platforms, `${path}.platforms`);
    validateImage(value.image, `${path}.image`);

    if (value.description !== undefined && value.description !== null) assertString(value.description, `${path}.description`);
    if (value.rating !== undefined && value.rating !== null) assertFiniteNumber(value.rating, `${path}.rating`, { min: 0 });
    if (value.votecount !== undefined && value.votecount !== null) assertFiniteNumber(value.votecount, `${path}.votecount`, { min: 0, integer: true });
    if (value.length_minutes !== undefined && value.length_minutes !== null) {
        assertFiniteNumber(value.length_minutes, `${path}.length_minutes`, { min: 0 });
    }

    if (value.tags !== undefined) {
        if (!Array.isArray(value.tags)) throw new BackupValidationError(`${path}.tags`, "must be an array");
        value.tags.forEach((tag, index) => {
            const tagPath = `${path}.tags[${index}]`;
            if (!isRecord(tag)) throw new BackupValidationError(tagPath, "must be an object");
            assertString(tag.name, `${tagPath}.name`, { nonEmpty: true });
            assertOptionalString(tag.id, `${tagPath}.id`);
            assertOptionalString(tag.category, `${tagPath}.category`);
        });
    }

    if (value.developers !== undefined) {
        if (!Array.isArray(value.developers)) throw new BackupValidationError(`${path}.developers`, "must be an array");
        value.developers.forEach((developer, index) => {
            const developerPath = `${path}.developers[${index}]`;
            if (!isRecord(developer)) throw new BackupValidationError(developerPath, "must be an object");
            assertString(developer.name, `${developerPath}.name`, { nonEmpty: true });
            assertOptionalString(developer.id, `${developerPath}.id`);
            assertOptionalString(developer.original, `${developerPath}.original`);
        });
    }

    if (value.screenshots !== undefined) {
        if (!Array.isArray(value.screenshots)) throw new BackupValidationError(`${path}.screenshots`, "must be an array");
        value.screenshots.forEach((screenshot, index) => {
            const screenshotPath = `${path}.screenshots[${index}]`;
            if (!isRecord(screenshot)) throw new BackupValidationError(screenshotPath, "must be an object");
            parseUrl(screenshot.url, `${screenshotPath}.url`, true);
            parseUrl(screenshot.thumbnail, `${screenshotPath}.thumbnail`, true);
            if (screenshot.sexual !== undefined) assertFiniteNumber(screenshot.sexual, `${screenshotPath}.sexual`, { min: 0, max: 2 });
            if (screenshot.violence !== undefined) assertFiniteNumber(screenshot.violence, `${screenshotPath}.violence`, { min: 0, max: 2 });
        });
    }

    if (value.extlinks !== undefined) {
        if (!Array.isArray(value.extlinks)) throw new BackupValidationError(`${path}.extlinks`, "must be an array");
        value.extlinks.forEach((link, index) => {
            const linkPath = `${path}.extlinks[${index}]`;
            if (!isRecord(link)) throw new BackupValidationError(linkPath, "must be an object");
            parseUrl(link.url, `${linkPath}.url`);
            assertOptionalString(link.label, `${linkPath}.label`);
            assertOptionalString(link.name, `${linkPath}.name`);
            assertOptionalString(link.id, `${linkPath}.id`);
        });
    }

    if (value.releases !== undefined) {
        if (!Array.isArray(value.releases)) throw new BackupValidationError(`${path}.releases`, "must be an array");
        value.releases.forEach((release, index) => {
            const releasePath = `${path}.releases[${index}]`;
            if (!isRecord(release)) throw new BackupValidationError(releasePath, "must be an object");
            assertOptionalString(release.id, `${releasePath}.id`);
            if (release.minage !== undefined && release.minage !== null) {
                assertFiniteNumber(release.minage, `${releasePath}.minage`, { min: 0, integer: true });
            }
            if (release.vns !== undefined) {
                if (!Array.isArray(release.vns)) throw new BackupValidationError(`${releasePath}.vns`, "must be an array");
                release.vns.forEach((vn, vnIndex) => {
                    const vnPath = `${releasePath}.vns[${vnIndex}]`;
                    if (!isRecord(vn)) throw new BackupValidationError(vnPath, "must be an object");
                    assertVnId(vn.id, `${vnPath}.id`);
                });
            }
        });
    }
}

function validateLibrary(
    value: unknown,
    path = "library",
    legacyRecordFormat = false,
): LibraryItem[] {
    if (!Array.isArray(value)) throw new BackupValidationError(path, "must be an array");

    const ids = new Set<string>();
    const migrated: LibraryItem[] = [];

    value.forEach((item, index) => {
        const itemPath = `${path}[${index}]`;
        if (!isRecord(item)) throw new BackupValidationError(itemPath, "must be an object");

        validateVN(item.vn, `${itemPath}.vn`);
        const vnId = (item.vn as Record<string, unknown>).id as string;
        if (ids.has(vnId)) throw new BackupValidationError(`${itemPath}.vn.id`, `duplicate id ${vnId}`);
        ids.add(vnId);

        if (typeof item.status !== "string" || !["playing", "completed", "on_hold", "dropped", "plan_to_play", "watched"].includes(item.status)) {
            throw new BackupValidationError(`${itemPath}.status`, "is invalid");
        }

        if (legacyRecordFormat) {
            assertFiniteNumber(item.score, `${itemPath}.score`, { min: 0, max: 100, integer: true });
        } else {
            if (item.recordVersion !== LIBRARY_RECORD_VERSION) {
                throw new BackupValidationError(`${itemPath}.recordVersion`, `must be ${LIBRARY_RECORD_VERSION}`);
            }
            if (
                typeof item.ownership !== "string" ||
                !OWNERSHIP_STATUSES.includes(item.ownership as (typeof OWNERSHIP_STATUSES)[number])
            ) {
                throw new BackupValidationError(`${itemPath}.ownership`, "is invalid");
            }
            if (item.score !== null) {
                assertFiniteNumber(item.score, `${itemPath}.score`, { min: 0, max: 100, integer: true });
            }

            for (const field of ["startedOn", "completedOn", "lastPlayedOn"] as const) {
                const dateValue = item[field];
                if (dateValue !== undefined && !isValidLibraryDate(dateValue)) {
                    throw new BackupValidationError(`${itemPath}.${field}`, "must be a valid YYYY-MM-DD date");
                }
            }
            if (
                typeof item.startedOn === "string" &&
                typeof item.completedOn === "string" &&
                item.startedOn > item.completedOn
            ) {
                throw new BackupValidationError(`${itemPath}.completedOn`, "must not be before startedOn");
            }
            if (
                item.resumeNote !== undefined &&
                (typeof item.resumeNote !== "string" || item.resumeNote.length > 200)
            ) {
                throw new BackupValidationError(`${itemPath}.resumeNote`, "must be a string of at most 200 characters");
            }
        }

        if (item.playTime !== undefined) {
            assertFiniteNumber(item.playTime, `${itemPath}.playTime`, { min: 0 });
        }

        assertString(item.notes, `${itemPath}.notes`);
        assertOptionalString(item.review, `${itemPath}.review`);
        assertOptionalString(item.purchaseLocation, `${itemPath}.purchaseLocation`);
        assertFiniteNumber(item.addedAt, `${itemPath}.addedAt`, { min: 0, integer: true });
        assertFiniteNumber(item.updatedAt, `${itemPath}.updatedAt`, { min: 0, integer: true });

        migrated.push(
            legacyRecordFormat
                ? migrateLibraryRecord(item) as LibraryItem
                : item as unknown as LibraryItem,
        );
    });

    return migrated;
}

function validatePurchaseSources(value: unknown): string[] {
    if (!Array.isArray(value)) throw new BackupValidationError("purchaseSources", "must be an array");

    const names: string[] = [];
    const seen = new Set<string>();
    value.forEach((entry, index) => {
        assertString(entry, `purchaseSources[${index}]`, { nonEmpty: true });
        const name = entry.trim();
        if (name !== entry) throw new BackupValidationError(`purchaseSources[${index}]`, "must not have surrounding whitespace");
        if (seen.has(name)) throw new BackupValidationError(`purchaseSources[${index}]`, `duplicate purchase source ${name}`);
        seen.add(name);
        names.push(name);
    });
    return names;
}

function validateSettings(value: unknown): BackupSettings {
    if (!isRecord(value)) throw new BackupValidationError("settings", "must be an object");

    if (value.language !== "ja" && value.language !== "en") {
        throw new BackupValidationError("settings.language", "must be ja or en");
    }
    if (typeof value.nsfwBlur !== "boolean") {
        throw new BackupValidationError("settings.nsfwBlur", "must be a boolean");
    }
    if (value.backgroundImage !== null) {
        parseUrl(value.backgroundImage, "settings.backgroundImage", true);
    }

    return {
        language: value.language,
        backgroundImage: value.backgroundImage as string | null,
        nsfwBlur: value.nsfwBlur,
    };
}

export function parseBackup(input: unknown): ParsedBackup {
    if (Array.isArray(input)) {
        return {
            schemaVersion: 0,
            exportedAt: null,
            library: validateLibrary(input, "legacy", true),
            legacy: true,
        };
    }

    if (!isRecord(input)) throw new BackupValidationError("backup", "must be an object or legacy library array");
    if (
        input.schemaVersion !== PREVIOUS_BACKUP_SCHEMA_VERSION &&
        input.schemaVersion !== BACKUP_SCHEMA_VERSION
    ) {
        throw new BackupValidationError(
            "schemaVersion",
            `unsupported schema version ${String(input.schemaVersion)}`,
        );
    }
    assertString(input.exportedAt, "exportedAt", { nonEmpty: true });
    if (!Number.isFinite(Date.parse(input.exportedAt))) {
        throw new BackupValidationError("exportedAt", "must be a valid date");
    }

    const previousVersion = input.schemaVersion === PREVIOUS_BACKUP_SCHEMA_VERSION;
    return {
        schemaVersion: input.schemaVersion,
        exportedAt: input.exportedAt,
        library: validateLibrary(input.library, "library", previousVersion),
        purchaseSources: validatePurchaseSources(input.purchaseSources),
        settings: validateSettings(input.settings),
        legacy: false,
    };
}

export function createBackupDocument(
    library: LibraryItem[],
    purchaseSources: string[],
    settings: BackupSettings,
    exportedAt = new Date(),
): BackupDocument {
    return {
        schemaVersion: BACKUP_SCHEMA_VERSION,
        exportedAt: exportedAt.toISOString(),
        library,
        purchaseSources,
        settings,
    };
}

export function createRestorePreview(backup: ParsedBackup, existingItems: LibraryItem[]): RestorePreview {
    const existingIds = new Set(existingItems.map((item) => item.vn.id));
    const conflicts = backup.library.filter((item) => existingIds.has(item.vn.id)).length;
    return {
        total: backup.library.length,
        additions: backup.library.length - conflicts,
        conflicts,
    };
}

export function planLibraryRestore(
    backupItems: LibraryItem[],
    existingItems: LibraryItem[],
    overwriteConflicts: boolean,
): RestoreLibraryPlan {
    const existingIds = new Set(existingItems.map((item) => item.vn.id));
    const itemsToWrite: LibraryItem[] = [];
    let additions = 0;
    let overwritten = 0;
    let skippedConflicts = 0;

    for (const item of backupItems) {
        const conflicts = existingIds.has(item.vn.id);
        if (conflicts && !overwriteConflicts) {
            skippedConflicts += 1;
            continue;
        }

        itemsToWrite.push(item);
        if (conflicts) {
            overwritten += 1;
        } else {
            additions += 1;
        }
    }

    return {
        itemsToWrite,
        additions,
        overwritten,
        skippedConflicts,
    };
}

export function selectLibraryItemsForRestore(
    backup: ParsedBackup,
    existingItems: LibraryItem[],
    overwriteConflicts: boolean,
): LibraryItem[] {
    return planLibraryRestore(
        backup.library,
        existingItems,
        overwriteConflicts,
    ).itemsToWrite;
}
