const LIBRARY_STATUSES = new Set([
    "all",
    "playing",
    "completed",
    "watched",
    "plan_to_play",
    "on_hold",
    "dropped",
]);
const OWNERSHIP_FILTERS = new Set(["all", "unknown", "owned", "wishlist"]);
const LIBRARY_SORTS = new Set([
    "score_desc",
    "score_asc",
    "added_desc",
    "added_asc",
    "released_desc",
    "released_asc",
    "rating_desc",
    "rating_asc",
    "title_asc",
    "title_desc",
    "vote_desc",
    "vote_asc",
]);
const LIBRARY_VIEWS = new Set(["grid", "list", "shelf"]);
const LIBRARY_QUERY_KEYS = ["q", "status", "ownership", "sort", "view"] as const;

/**
 * Resolve a detail page's `from` parameter to one of the app's supported local
 * return paths. Never infer the destination from browser history.
 */
export function getSafeDetailReturnPath(fromValues: readonly string[]): string {
    if (fromValues.length !== 1) return "/";

    const from = fromValues[0];
    if (
        !from ||
        !from.startsWith("/") ||
        from.startsWith("//") ||
        /[\\\u0000-\u001f\u007f#]/.test(from) ||
        /%(?![\da-f]{2})/i.test(from)
    ) {
        return "/";
    }

    const queryIndex = from.indexOf("?");
    const pathname = queryIndex === -1 ? from : from.slice(0, queryIndex);
    if (pathname !== "/" && pathname !== "/search") return "/";
    if (queryIndex === -1) return "/";

    const rawQuery = from.slice(queryIndex + 1);
    if (!rawQuery) return "/";

    try {
        // URLSearchParams is intentionally forgiving of malformed percent escapes.
        // Reject them explicitly so only well-formed app-generated targets pass.
        decodeURIComponent(rawQuery.replace(/\+/g, " "));
    } catch {
        return "/";
    }

    const params = new URLSearchParams(rawQuery);
    const entries = Array.from(params.entries());
    const keys = entries.map(([key]) => key);
    if (new Set(keys).size !== keys.length) return "/";

    if (pathname === "/search") {
        if (keys.length !== 1 || keys[0] !== "q") return "/";
        const query = params.get("q") ?? "";
        return query.trim() ? `/search?q=${encodeURIComponent(query)}` : "/";
    }

    if (
        keys.length === 0 ||
        keys.some((key) => !LIBRARY_QUERY_KEYS.includes(key as typeof LIBRARY_QUERY_KEYS[number]))
    ) {
        return "/";
    }

    const values = Object.fromEntries(entries);
    if (values.q !== undefined && !values.q.trim()) return "/";
    if (values.status !== undefined && !LIBRARY_STATUSES.has(values.status)) return "/";
    if (values.ownership !== undefined && !OWNERSHIP_FILTERS.has(values.ownership)) return "/";
    if (values.sort !== undefined && !LIBRARY_SORTS.has(values.sort)) return "/";
    if (values.view !== undefined && !LIBRARY_VIEWS.has(values.view)) return "/";

    const safeParams = new URLSearchParams();
    for (const key of LIBRARY_QUERY_KEYS) {
        const value = values[key];
        if (value !== undefined) safeParams.set(key, value);
    }
    return `/?${safeParams.toString()}`;
}
