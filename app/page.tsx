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
import { Plus, LayoutGrid, List, Clock, Star, Dices, Library, Search } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/context/LanguageContext";
import { useSettings } from "@/context/SettingsContext";
import { shouldBlurImage } from "@/lib/image-safety";
import { cn } from "@/lib/utils";
import { compareLibraryScores } from "@/lib/library-score";
import { matchesLibrarySearch } from "@/lib/library-filter";
import { getDisplayTitle } from "@/lib/vndb-title";

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
        { value: "completed" as const, label: t.status.completed },
        { value: "watched" as const, label: t.status.watched },
        { value: "plan_to_play" as const, label: t.status.plan_to_play },
        { value: "on_hold" as const, label: t.status.on_hold },
        { value: "dropped" as const, label: t.status.dropped },
    ], [t]);

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

    const clearFilters = () => {
        setQueryInput("");
        replaceLibraryUrl({ query: "", filter: "all", ownershipFilter: "all" });
    };

    if (isLoading) {
        return <div className="flex items-center justify-center h-64 text-gray-500">{t.common.loading}</div>;
    }

    if (loadError) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
                <h2 className="text-2xl font-bold">{t.home.loadErrorTitle}</h2>
                <p className="text-gray-400 max-w-md">{t.home.loadErrorDesc}</p>
                <Button onClick={() => void reloadLibrary()}>{t.home.retryLoad}</Button>
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6">
                <div className="w-24 h-24 rounded-full bg-secondary/50 flex items-center justify-center">
                    <Plus className="w-10 h-10 text-gray-500" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold">{t.home.emptyTitle}</h2>
                    <p className="text-gray-400 max-w-sm">{t.home.emptyDesc}</p>
                </div>
                <Button asChild size="lg" className="rounded-full shadow-lg shadow-primary/25">
                    <Link href="/search">{t.home.addButton}</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h1 className="text-3xl font-bold">{t.home.title}</h1>

                    <div className="flex items-center gap-2 flex-wrap">
                        <Button asChild className="gap-2 min-h-11">
                            <Link href="/search">
                                <Plus className="w-4 h-4" aria-hidden="true" />
                                {t.home.addButton}
                            </Link>
                        </Button>
                        <Button
                            variant="outline"
                            className="gap-2 min-h-11 border-accent/20 text-accent hover:bg-accent/10 hover:text-accent"
                            onClick={() => setIsRouletteOpen(true)}
                            aria-label={t.home.rouletteButton}
                        >
                            <Dices className="w-4 h-4" aria-hidden="true" />
                            <span className="hidden sm:inline text-white">{t.home.rouletteButton}</span>
                        </Button>
                    </div>
                </div>

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

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <Tabs
                        value={filter}
                        onValueChange={(value) => {
                            const nextFilter = value as LibraryFilter;
                            replaceLibraryUrl({ filter: nextFilter });
                        }}
                        className="min-w-0"
                    >
                        <TabsList className="w-full justify-start overflow-x-auto no-scrollbar bg-transparent p-0 h-auto gap-2">
                            {statusFilters.map((status) => (
                                <TabsTrigger
                                    key={status.value}
                                    value={status.value}
                                    className="rounded-full px-4 py-2 data-[state=active]:bg-white data-[state=active]:text-black data-[state=inactive]:bg-secondary data-[state=inactive]:text-gray-400 transition-all"
                                >
                                    {status.label}
                                    <span className="ml-2 text-xs opacity-70">({statusCounts[status.value] || 0})</span>
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>

                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                        <Select
                            value={ownershipFilter}
                            onValueChange={(value) => {
                                const nextOwnership = value as OwnershipStatus | "all";
                                replaceLibraryUrl({ ownershipFilter: nextOwnership });
                            }}
                        >
                            <SelectTrigger aria-label={t.common.ownership} className="w-full sm:w-[150px] min-h-11 bg-secondary/50 border-white/5">
                                <SelectValue placeholder={t.common.ownership} />
                            </SelectTrigger>
                            <SelectContent>
                                {ownershipFilters.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select
                            value={sort}
                            onValueChange={(value) => {
                                const nextSort = value as SortOption;
                                replaceLibraryUrl({ sort: nextSort });
                            }}
                        >
                            <SelectTrigger aria-label={t.home.sort} className="w-full sm:w-[180px] min-h-11 bg-secondary/50 border-white/5">
                                <SelectValue placeholder={t.sort.label} />
                            </SelectTrigger>
                            <SelectContent>
                                {sortOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <div role="group" aria-label={t.home.view} className="flex items-center gap-1 bg-secondary/50 p-1 rounded-lg border border-white/5 self-start">
                            <Button
                                variant={viewMode === "grid" ? "default" : "ghost"}
                                className="h-11 px-2 sm:px-3"
                                onClick={() => {
                                    replaceLibraryUrl({ viewMode: "grid" });
                                }}
                                aria-label={t.home.gridView}
                                aria-pressed={viewMode === "grid"}
                                title={t.home.gridView}
                            >
                                <LayoutGrid className="w-4 h-4" aria-hidden="true" />
                                <span className="hidden sm:inline text-xs">{t.home.gridView}</span>
                            </Button>
                            <Button
                                variant={viewMode === "list" ? "default" : "ghost"}
                                className="h-11 px-2 sm:px-3"
                                onClick={() => {
                                    replaceLibraryUrl({ viewMode: "list" });
                                }}
                                aria-label={t.home.listView}
                                aria-pressed={viewMode === "list"}
                                title={t.home.listView}
                            >
                                <List className="w-4 h-4" aria-hidden="true" />
                                <span className="hidden sm:inline text-xs">{t.home.listView}</span>
                            </Button>
                            <Button
                                variant={viewMode === "shelf" ? "default" : "ghost"}
                                className="h-11 px-2 sm:px-3"
                                onClick={() => {
                                    replaceLibraryUrl({ viewMode: "shelf" });
                                }}
                                aria-label={t.home.shelfView}
                                aria-pressed={viewMode === "shelf"}
                                title={t.home.shelfView}
                            >
                                <Library className="w-4 h-4" aria-hidden="true" />
                                <span className="hidden sm:inline text-xs">{t.home.shelfView}</span>
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                    <p aria-live="polite">{resultCount}</p>
                    {hasConditions && (
                        <Button type="button" variant="ghost" className="min-h-11 px-3" onClick={clearFilters}>
                            {t.home.clearFilters}
                        </Button>
                    )}
                </div>
            </div>

            {filteredAndSortedItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-16 text-center">
                    <h2 className="text-xl font-bold">{t.home.filteredEmptyTitle}</h2>
                    <p className="mt-2 max-w-md text-muted-foreground">{t.home.filteredEmptyDesc}</p>
                    <Button type="button" variant="outline" className="mt-6 min-h-11" onClick={clearFilters}>
                        {t.home.clearFilters}
                    </Button>
                </div>
            ) : viewMode === "grid" ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {filteredAndSortedItems.map((item) => (
                        <VNCard
                            key={item.vn.id}
                            vn={item.vn}
                            libraryItem={item}
                            detailHref={getDetailPath(item.vn.id, returnTo)}
                        />
                    ))}
                </div>
            ) : viewMode === "list" ? (
                <div className="space-y-2">
                    {filteredAndSortedItems.map((item) => {
                        const shouldBlur = shouldBlurImage(item.vn.image?.sexual, nsfwBlur);

                        return (
                            <Link
                                href={getDetailPath(item.vn.id, returnTo)}
                                key={item.vn.id}
                                className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors group"
                            >
                                <div className="flex-shrink-0 w-12 h-16 rounded overflow-hidden bg-secondary relative">
                                    {item.vn.image && (
                                        <img
                                            src={item.vn.image.url}
                                            alt=""
                                            className={cn(
                                                "w-full h-full object-cover transition-all",
                                                shouldBlur && "blur-md scale-110"
                                            )}
                                        />
                                    )}
                                    {shouldBlur && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
                                            <Badge variant="destructive" className="bg-red-600/80 text-[8px] h-4 px-1 py-0 border-none">{t.settings.imageBlurred}</Badge>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-lg line-clamp-2 group-hover:text-primary transition-colors">{getDisplayTitle(item.vn, language)}</h3>
                                    {item.vn.developers?.[0]?.name && (
                                        <p className="truncate text-xs text-muted-foreground">{item.vn.developers[0].name}</p>
                                    )}
                                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400 mt-1">
                                        <div className="flex items-center gap-1">
                                            <Star className="w-3 h-3 text-yellow-500" aria-hidden="true" />
                                            <span className="text-yellow-500 font-bold">{item.score === null ? t.common.unrated : `${item.score}/100`}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Clock className="w-3 h-3 text-green-500" aria-hidden="true" />
                                            <span>{item.playTime ? (item.playTime / 60).toFixed(1) : "0.0"}h</span>
                                        </div>
                                        <Badge variant="secondary" className="text-xs">
                                            {statusFilters.find((status) => status.value === item.status)?.label}
                                        </Badge>
                                        <Badge variant="outline" className="text-xs">
                                            {t.ownership[item.ownership]}
                                        </Badge>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            ) : (
                <ShelfView items={filteredAndSortedItems} returnTo={returnTo} />
            )}

            <RouletteModal
                isOpen={isRouletteOpen}
                onClose={() => setIsRouletteOpen(false)}
                items={items}
            />
        </div>
    );
}
