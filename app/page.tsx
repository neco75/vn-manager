"use client";

import { useLibrary } from "@/context/LibraryContext";
import { VNCard } from "@/components/VNCard";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
    GAME_STATUSES,
    GameStatus,
    OWNERSHIP_STATUSES,
    OwnershipStatus,
} from "@/types/library";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, LayoutGrid, List, Dices, Library, Search } from "lucide-react";
import dynamic from "next/dynamic";

const RouletteModal = dynamic(() => import("@/components/RouletteModal").then(mod => mod.RouletteModal), {
    ssr: false,
});
import { ShelfView } from "@/components/ShelfView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/context/LanguageContext";
import { useSettings } from "@/context/SettingsContext";
import { shouldBlurImage } from "@/lib/image-safety";
import { cn } from "@/lib/utils";
import { compareLibraryScores } from "@/lib/library-score";
import { matchesLibrarySearch } from "@/lib/library-filter";
import { getDisplayTitle } from "@/lib/vndb-title";
import { getSafeLibraryReturnScroll, LIBRARY_RETURN_STORAGE_KEY } from "@/lib/detail-return";

type SortOption = "score_desc" | "score_asc" | "added_desc" | "added_asc" | "released_desc" | "released_asc" | "rating_desc" | "rating_asc" | "title_asc" | "title_desc" | "vote_desc" | "vote_asc";
type ViewMode = "grid" | "list" | "shelf";
type LibraryFilter = GameStatus | "all";

interface LibraryUrlState {
    query: string;
    filter: LibraryFilter;
    ownershipFilter: OwnershipStatus | "all";
    sort: SortOption;
    viewMode: ViewMode;
}

const DEFAULT_SORT: SortOption = "added_desc";
const DEFAULT_VIEW: ViewMode = "grid";
const VALID_FILTERS = new Set<LibraryFilter>(["all", ...GAME_STATUSES]);
const VALID_OWNERSHIP_FILTERS = new Set<OwnershipStatus | "all">(["all", ...OWNERSHIP_STATUSES]);
const VALID_SORTS = new Set<SortOption>([
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
const VALID_VIEWS = new Set<ViewMode>(["grid", "list", "shelf"]);
const DESKTOP_STATUS_FILTERS = ["all", "playing", "plan_to_play", "completed"] as const;
const OTHER_STATUSES = new Set<GameStatus>(["on_hold", "dropped", "watched"]);

function parseLibraryUrl(params: URLSearchParams): LibraryUrlState {
    const filter = params.get("status");
    const ownershipFilter = params.get("ownership");
    const sort = params.get("sort");
    const viewMode = params.get("view");

    return {
        query: params.get("q") ?? "",
        filter: filter && VALID_FILTERS.has(filter as LibraryFilter)
            ? filter as LibraryFilter
            : "all",
        ownershipFilter: ownershipFilter && VALID_OWNERSHIP_FILTERS.has(ownershipFilter as OwnershipStatus | "all")
            ? ownershipFilter as OwnershipStatus | "all"
            : "all",
        sort: sort && VALID_SORTS.has(sort as SortOption) ? sort as SortOption : DEFAULT_SORT,
        viewMode: viewMode && VALID_VIEWS.has(viewMode as ViewMode) ? viewMode as ViewMode : DEFAULT_VIEW,
    };
}

function buildLibraryPath(state: LibraryUrlState): string {
    const params = new URLSearchParams();
    const query = state.query;

    if (query.trim()) params.set("q", query);
    if (state.filter !== "all") params.set("status", state.filter);
    if (state.ownershipFilter !== "all") params.set("ownership", state.ownershipFilter);
    if (state.sort !== DEFAULT_SORT) params.set("sort", state.sort);
    if (state.viewMode !== DEFAULT_VIEW) params.set("view", state.viewMode);

    const queryString = params.toString();
    return queryString ? `/?${queryString}` : "/";
}

function getDetailPath(id: string, returnTo: string): string {
    return `/vn/${id}?from=${encodeURIComponent(returnTo)}`;
}

export default function Home() {
    return (
        <Suspense fallback={<div className="min-h-64" />}>
            <HomeContent />
        </Suspense>
    );
}

function HomeContent() {
    const { items, isLoading, loadError, reloadLibrary } = useLibrary();
    const { language, t } = useLanguage();
    const router = useRouter();
    const searchParams = useSearchParams();
    const searchParamsString = searchParams.toString();
    const urlState = useMemo(
        () => parseLibraryUrl(new URLSearchParams(searchParamsString)),
        [searchParamsString],
    );
    const previousSearchParamsStringRef = useRef(searchParamsString);
    const [queryInput, setQueryInput] = useState(urlState.query);
    const [isRouletteOpen, setIsRouletteOpen] = useState(false);
    const pendingReturnScrollRef = useRef<{ path: string; scrollY: number } | null>(null);
    const didReadReturnScrollRef = useRef(false);
    const { nsfwBlur } = useSettings();

    const { filter, ownershipFilter, viewMode, sort } = urlState;
    const query = queryInput;

    useEffect(() => {
        const urlChanged = previousSearchParamsStringRef.current !== searchParamsString;
        previousSearchParamsStringRef.current = searchParamsString;
        if (urlChanged) {
            // URL navigation is an external source of truth for the local input.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setQueryInput(urlState.query);
        }

        const currentPath = searchParamsString ? `/?${searchParamsString}` : "/";
        const canonicalPath = buildLibraryPath(urlState);
        if (currentPath !== canonicalPath) {
            router.replace(canonicalPath, { scroll: false });
        }
    }, [router, searchParamsString, urlState]);

    const replaceLibraryUrl = (updates: Partial<LibraryUrlState>) => {
        const nextState: LibraryUrlState = {
            query,
            filter,
            ownershipFilter,
            sort,
            viewMode,
            ...updates,
        };
        router.replace(buildLibraryPath(nextState), { scroll: false });
    };

    const replaceSearchUrl = (value: string) => {
        window.history.replaceState(
            null,
            "",
            buildLibraryPath({ query: value, filter, ownershipFilter, sort, viewMode }),
        );
    };

    const statusFilters = useMemo(() => [
        { value: "all" as const, label: t.status.all },
        { value: "playing" as const, label: t.status.playing },
        { value: "plan_to_play" as const, label: t.status.plan_to_play },
        { value: "completed" as const, label: t.status.completed },
        { value: "on_hold" as const, label: t.status.on_hold },
        { value: "dropped" as const, label: t.status.dropped },
        { value: "watched" as const, label: t.status.watched },
    ], [t]);
    const desktopStatusFilters = statusFilters.filter((status) =>
        DESKTOP_STATUS_FILTERS.some((value) => value === status.value),
    );
    const otherStatusFilters = statusFilters.filter((status) =>
        status.value !== "all" && OTHER_STATUSES.has(status.value as GameStatus),
    );

    const ownershipFilters = useMemo(() => [
        { value: "all" as const, label: t.ownership.all },
        { value: "unknown" as const, label: t.ownership.unknown },
        { value: "owned" as const, label: t.ownership.owned },
        { value: "wishlist" as const, label: t.ownership.wishlist },
    ], [t]);

    const sortOptions = useMemo(() => [
        { value: "added_desc" as const, label: t.sort.added_desc },
        { value: "added_asc" as const, label: t.sort.added_asc },
        { value: "score_desc" as const, label: t.sort.score_desc },
        { value: "score_asc" as const, label: t.sort.score_asc },
        { value: "released_desc" as const, label: t.sort.released_desc },
        { value: "released_asc" as const, label: t.sort.released_asc },
        { value: "rating_desc" as const, label: t.sort.rating_desc },
        { value: "rating_asc" as const, label: t.sort.rating_asc },
        { value: "title_asc" as const, label: t.sort.title_asc },
        { value: "title_desc" as const, label: t.sort.title_desc },
        { value: "vote_desc" as const, label: t.sort.vote_desc },
        { value: "vote_asc" as const, label: t.sort.vote_asc },
    ], [t]);

    const statusCounts = useMemo(() => {
        const counts: Record<LibraryFilter, number> = {
            all: items.length,
            playing: 0,
            completed: 0,
            watched: 0,
            plan_to_play: 0,
            on_hold: 0,
            dropped: 0,
        };
        items.forEach((item) => {
            counts[item.status]++;
        });
        return counts;
    }, [items]);
    const otherStatusCount = statusCounts.on_hold + statusCounts.dropped + statusCounts.watched;

    const filteredItems = useMemo(() => {
        return items.filter((item) => {
            if (filter !== "all" && item.status !== filter) return false;
            if (ownershipFilter !== "all" && item.ownership !== ownershipFilter) return false;
            return matchesLibrarySearch(item, query);
        });
    }, [filter, items, ownershipFilter, query]);

    const filteredAndSortedItems = useMemo(() => {
        return [...filteredItems].sort((a, b) => {
            let comparison = 0;
            switch (sort) {
                case "score_desc":
                    comparison = compareLibraryScores(a, b, "desc");
                    break;
                case "score_asc":
                    comparison = compareLibraryScores(a, b, "asc");
                    break;
                case "added_desc":
                    comparison = b.addedAt - a.addedAt;
                    break;
                case "added_asc":
                    comparison = a.addedAt - b.addedAt;
                    break;
                case "released_desc":
                    comparison = (b.vn.released || "").localeCompare(a.vn.released || "");
                    break;
                case "released_asc":
                    comparison = (a.vn.released || "").localeCompare(b.vn.released || "");
                    break;
                case "rating_desc":
                    comparison = (b.vn.rating || 0) - (a.vn.rating || 0);
                    break;
                case "rating_asc":
                    comparison = (a.vn.rating || 0) - (b.vn.rating || 0);
                    break;
                case "title_asc":
                    comparison = getDisplayTitle(a.vn, language).localeCompare(getDisplayTitle(b.vn, language));
                    break;
                case "title_desc":
                    comparison = getDisplayTitle(b.vn, language).localeCompare(getDisplayTitle(a.vn, language));
                    break;
                case "vote_desc":
                    comparison = (b.vn.votecount || 0) - (a.vn.votecount || 0);
                    break;
                case "vote_asc":
                    comparison = (a.vn.votecount || 0) - (b.vn.votecount || 0);
                    break;
            }
            return comparison || a.vn.id.localeCompare(b.vn.id);
        });
    }, [filteredItems, language, sort]);

    const returnTo = buildLibraryPath({ query, filter, ownershipFilter, sort, viewMode });
    const hasConditions = Boolean(query.trim()) || filter !== "all" || ownershipFilter !== "all";
    const resultCount = t.home.resultCount
        .replace("{matched}", String(filteredItems.length))
        .replace("{total}", String(items.length));

    useEffect(() => {
        if (!didReadReturnScrollRef.current) {
            didReadReturnScrollRef.current = true;

            let raw: string | null;
            try {
                raw = window.sessionStorage.getItem(LIBRARY_RETURN_STORAGE_KEY);
            } catch {
                return;
            }
            if (raw) {
                const scrollY = getSafeLibraryReturnScroll(raw, returnTo);
                try {
                    window.sessionStorage.removeItem(LIBRARY_RETURN_STORAGE_KEY);
                } catch {
                    // A failed cleanup must not block the library or its controls.
                }
                if (scrollY !== null) pendingReturnScrollRef.current = { path: returnTo, scrollY };
            }
        }

        const pending = pendingReturnScrollRef.current;
        if (!pending) return;
        if (pending.path !== returnTo || loadError) {
            pendingReturnScrollRef.current = null;
            return;
        }
        if (isLoading) return;

        let secondFrame = 0;
        const firstFrame = window.requestAnimationFrame(() => {
            secondFrame = window.requestAnimationFrame(() => {
                if (pendingReturnScrollRef.current !== pending) return;
                try {
                    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
                    window.scrollTo(0, Math.min(pending.scrollY, maxScroll));
                } catch {
                    // Return to the normal top-of-page position if restoration is unavailable.
                }
                pendingReturnScrollRef.current = null;
            });
        });

        return () => {
            window.cancelAnimationFrame(firstFrame);
            window.cancelAnimationFrame(secondFrame);
        };
    }, [isLoading, loadError, returnTo]);

    const saveLibraryReturnPosition = () => {
        try {
            window.sessionStorage.setItem(
                LIBRARY_RETURN_STORAGE_KEY,
                JSON.stringify({ path: returnTo, scrollY: window.scrollY }),
            );
        } catch {
            // Library navigation remains usable when session storage is unavailable.
        }
    };

    const clearFilters = () => {
        setQueryInput("");
        replaceLibraryUrl({ query: "", filter: "all", ownershipFilter: "all" });
    };

    if (isLoading) {
        return (
            <div role="status" aria-live="polite" aria-busy="true" aria-label={t.common.loading} className="space-y-6">
                <div className="h-9 w-48 animate-pulse rounded bg-secondary" aria-hidden="true" />
                <div className="h-11 animate-pulse rounded-lg bg-secondary" aria-hidden="true" />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-5" aria-hidden="true">
                    {[0, 1, 2, 3].map((index) => <div key={index} className="aspect-[2/3] animate-pulse rounded-xl bg-secondary" />)}
                </div>
                <span className="sr-only">{t.common.loading}</span>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="flex min-h-64 flex-col items-center justify-center space-y-4 text-center" role="alert">
                <h1 className="text-2xl font-bold">{t.home.loadErrorTitle}</h1>
                <p className="max-w-md text-muted-foreground">{t.home.loadErrorDesc}</p>
                <Button className="min-h-11" onClick={() => void reloadLibrary().catch(() => undefined)}>{t.home.retryLoad}</Button>
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="space-y-8">
                <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <h1 className="text-2xl font-bold leading-[1.35] sm:text-[28px] sm:leading-[1.3]">{t.home.title}</h1>
                        <p aria-live="polite" className="text-sm text-muted-foreground">{resultCount}</p>
                    </div>
                    <Button asChild className="min-h-11 gap-2 sm:self-start">
                        <Link href="/search">
                            <Plus className="h-4 w-4" aria-hidden="true" />
                            {t.home.addButton}
                        </Link>
                    </Button>
                </header>

                <section className="space-y-3 rounded-xl border border-border bg-card px-5 py-8 text-center sm:px-8">
                    <h2 className="text-xl font-semibold">{t.home.emptyTitle}</h2>
                    <p className="mx-auto max-w-md text-sm text-muted-foreground">{t.home.emptyDesc}</p>
                    <Button asChild variant="outline" className="mt-2 min-h-11">
                        <Link href="/settings#backup">{t.home.restoreFromBackup}</Link>
                    </Button>
                </section>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h1 className="text-2xl font-bold leading-[1.35] sm:text-[28px] sm:leading-[1.3]">{t.home.title}</h1>
                    <p aria-live="polite" className="text-sm text-muted-foreground">{resultCount}</p>
                    {hasConditions && (
                        <Button type="button" variant="ghost" className="min-h-11 px-3" onClick={clearFilters}>
                            {t.home.clearFilters}
                        </Button>
                    )}
                </div>

                <div className="flex w-full items-center gap-2 sm:w-auto sm:flex-none">
                    <Button asChild className="min-h-11 flex-1 gap-2 sm:flex-none">
                        <Link href="/search">
                            <Plus className="h-4 w-4" aria-hidden="true" />
                            {t.home.addButton}
                        </Link>
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 min-w-11 gap-2 px-3"
                        onClick={() => setIsRouletteOpen(true)}
                        aria-label={t.home.rouletteButton}
                        title={t.home.rouletteButton}
                    >
                        <Dices className="h-4 w-4" aria-hidden="true" />
                        <span className="hidden sm:inline">{t.home.rouletteButton}</span>
                    </Button>
                </div>
            </header>

            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                    type="search"
                    value={query}
                    onChange={(event) => {
                        const value = event.target.value;
                        setQueryInput(value);
                        replaceSearchUrl(value);
                    }}
                    placeholder={t.home.searchPlaceholder}
                    aria-label={t.home.searchPlaceholder}
                    className="min-h-11 pl-9"
                />
            </div>

            <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-2 md:hidden">
                    <Select
                        value={filter}
                        onValueChange={(value) => replaceLibraryUrl({ filter: value as LibraryFilter })}
                    >
                        <SelectTrigger aria-label={t.common.status} className="min-h-11 w-full border-input bg-card">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {statusFilters.map((status) => (
                                <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select
                        value={ownershipFilter}
                        onValueChange={(value) => replaceLibraryUrl({ ownershipFilter: value as OwnershipStatus | "all" })}
                    >
                        <SelectTrigger aria-label={t.common.ownership} className="min-h-11 w-full border-input bg-card">
                            <SelectValue placeholder={t.common.ownership} />
                        </SelectTrigger>
                        <SelectContent>
                            {ownershipFilters.map((option) => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="hidden min-w-0 flex-wrap items-center gap-2 md:flex">
                    <div
                        role="group"
                        aria-label={t.common.status}
                        onKeyDown={(event) => {
                            if ((event.key !== "ArrowLeft" && event.key !== "ArrowRight") || !(event.target instanceof HTMLButtonElement)) return;
                            const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
                            const index = buttons.indexOf(event.target);
                            if (index < 0) return;
                            const offset = event.key === "ArrowRight" ? 1 : -1;
                            const next = buttons[(index + offset + buttons.length) % buttons.length];
                            next.focus();
                            next.click();
                            event.preventDefault();
                        }}
                        className="flex min-w-0 flex-1 items-center justify-start gap-2 overflow-x-auto"
                    >
                        {desktopStatusFilters.map((status) => (
                            <Button
                                key={status.value}
                                type="button"
                                variant={filter === status.value ? "default" : "secondary"}
                                onClick={() => replaceLibraryUrl({ filter: status.value as LibraryFilter })}
                                aria-pressed={filter === status.value}
                                className="min-h-11 shrink-0 gap-1.5 rounded-lg px-3"
                            >
                                {status.label}
                                <span className="ml-2 text-[13px] tabular-nums">({statusCounts[status.value]})</span>
                            </Button>
                        ))}
                    </div>

                    <Select
                        value={OTHER_STATUSES.has(filter as GameStatus) ? filter : ""}
                        onValueChange={(value) => replaceLibraryUrl({ filter: value as GameStatus })}
                    >
                        <SelectTrigger aria-label={t.home.otherStatuses} className="min-h-11 w-[142px] shrink-0 border-input bg-card">
                            <SelectValue placeholder={`${t.home.otherStatuses} (${otherStatusCount})`} />
                        </SelectTrigger>
                        <SelectContent>
                            {otherStatusFilters.map((status) => (
                                <SelectItem key={status.value} value={status.value}>
                                    {status.label} ({statusCounts[status.value]})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select
                        value={ownershipFilter}
                        onValueChange={(value) => replaceLibraryUrl({ ownershipFilter: value as OwnershipStatus | "all" })}
                    >
                        <SelectTrigger aria-label={t.common.ownership} className="min-h-11 w-[150px] shrink-0 border-input bg-card">
                            <SelectValue placeholder={t.common.ownership} />
                        </SelectTrigger>
                        <SelectContent>
                            {ownershipFilters.map((option) => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                    <Select
                        value={sort}
                        onValueChange={(value) => replaceLibraryUrl({ sort: value as SortOption })}
                    >
                        <SelectTrigger aria-label={t.home.sort} className="min-h-11 w-full border-input bg-card sm:w-[220px]">
                            <SelectValue placeholder={t.sort.label} />
                        </SelectTrigger>
                        <SelectContent>
                            {sortOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <div role="group" aria-label={t.home.view} className="flex w-full items-center justify-center gap-1 rounded-lg border border-border bg-secondary p-1 sm:w-auto">
                        <Button
                            type="button"
                            variant={viewMode === "grid" ? "default" : "ghost"}
                            className="h-11 min-w-11 px-2 sm:px-3"
                            onClick={() => replaceLibraryUrl({ viewMode: "grid" })}
                            aria-label={t.home.gridView}
                            aria-pressed={viewMode === "grid"}
                            title={t.home.gridView}
                        >
                            <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                            <span className="hidden text-sm sm:inline">{t.home.gridView}</span>
                        </Button>
                        <Button
                            type="button"
                            variant={viewMode === "list" ? "default" : "ghost"}
                            className="h-11 min-w-11 px-2 sm:px-3"
                            onClick={() => replaceLibraryUrl({ viewMode: "list" })}
                            aria-label={t.home.listView}
                            aria-pressed={viewMode === "list"}
                            title={t.home.listView}
                        >
                            <List className="h-4 w-4" aria-hidden="true" />
                            <span className="hidden text-sm sm:inline">{t.home.listView}</span>
                        </Button>
                        <Button
                            type="button"
                            variant={viewMode === "shelf" ? "default" : "ghost"}
                            className="h-11 min-w-11 px-2 sm:px-3"
                            onClick={() => replaceLibraryUrl({ viewMode: "shelf" })}
                            aria-label={t.home.shelfView}
                            aria-pressed={viewMode === "shelf"}
                            title={t.home.shelfView}
                        >
                            <Library className="h-4 w-4" aria-hidden="true" />
                            <span className="hidden text-sm sm:inline">{t.home.shelfView}</span>
                        </Button>
                    </div>
                </div>
            </div>

            {filteredAndSortedItems.length === 0 ? (
                <div className="rounded-xl border border-border bg-card px-6 py-12 text-center">
                    <h2 className="text-xl font-semibold">{t.home.filteredEmptyTitle}</h2>
                    <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{t.home.filteredEmptyDesc}</p>
                </div>
            ) : viewMode === "grid" ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-5">
                    {filteredAndSortedItems.map((item) => (
                        <VNCard
                            key={item.vn.id}
                            vn={item.vn}
                            libraryItem={item}
                            detailHref={getDetailPath(item.vn.id, returnTo)}
                            onDetailClick={saveLibraryReturnPosition}
                        />
                    ))}
                </div>
            ) : viewMode === "list" ? (
                <div className="space-y-2">
                    {filteredAndSortedItems.map((item) => {
                        const shouldBlur = shouldBlurImage(item.vn.image?.sexual, nsfwBlur);
                        const displayTitle = getDisplayTitle(item.vn, language);

                        return (
                            <Link
                                href={getDetailPath(item.vn.id, returnTo)}
                                key={item.vn.id}
                                aria-label={displayTitle}
                                onClick={saveLibraryReturnPosition}
                                className="group flex min-h-24 items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors duration-150 hover:bg-accent/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                            >
                                <div className="relative h-[72px] w-12 shrink-0 overflow-hidden rounded-md border border-border bg-secondary">
                                    {item.vn.image ? (
                                        <img
                                            src={item.vn.image.url}
                                            alt=""
                                            className={cn("h-full w-full object-cover", shouldBlur && "scale-110 blur-md")}
                                        />
                                    ) : (
                                        <span className="flex h-full items-center justify-center px-1 text-center text-[11px] text-muted-foreground">
                                            {t.common.noImage}
                                        </span>
                                    )}
                                    {item.vn.image && shouldBlur && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-background/80 px-0.5">
                                            <span className="text-center text-[10px] leading-3 text-foreground">{t.settings.imageBlurred}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h2 className="line-clamp-2 text-sm font-semibold leading-5 text-foreground group-hover:text-primary sm:text-base">
                                        {displayTitle}
                                    </h2>
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                        <Badge variant="secondary" className="text-[13px]">
                                            {statusFilters.find((status) => status.value === item.status)?.label}
                                        </Badge>
                                        <span className="text-sm font-semibold tabular-nums text-foreground">
                                            {item.score === null ? t.common.unrated : `${item.score}/100`}
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            ) : (
                <ShelfView items={filteredAndSortedItems} returnTo={returnTo} onDetailClick={saveLibraryReturnPosition} />
            )}

            <RouletteModal
                isOpen={isRouletteOpen}
                onClose={() => setIsRouletteOpen(false)}
                items={items}
            />
        </div>
    );
}
