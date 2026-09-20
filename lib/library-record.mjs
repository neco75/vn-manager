/** @type {2} */
export const LIBRARY_RECORD_VERSION = 2;

/** @type {readonly ["unknown", "owned", "wishlist"]} */
export const OWNERSHIP_STATUSES = ["unknown", "owned", "wishlist"];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidLibraryDate(value) {
    if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    );
}

export function migrateLibraryRecord(item) {
    if (item.recordVersion === LIBRARY_RECORD_VERSION) {
        return {
            ...item,
            ownership: OWNERSHIP_STATUSES.includes(item.ownership)
                ? item.ownership
                : "unknown",
            score: item.score === null || typeof item.score === "number"
                ? item.score
                : null,
        };
    }

    return {
        ...item,
        recordVersion: LIBRARY_RECORD_VERSION,
        ownership: OWNERSHIP_STATUSES.includes(item.ownership)
            ? item.ownership
            : "unknown",
        score: item.score === 0 || item.score === undefined || item.score === null
            ? null
            : item.score,
    };
}
