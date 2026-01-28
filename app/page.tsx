"use client";

import { useLibrary } from "@/context/LibraryContext";
import { VNCard } from "@/components/VNCard";
import { useState, useMemo } from "react";
import { LibraryItem, GameStatus } from "@/types/library";
import Link from "next/link";
import { Plus, LayoutGrid, List, Clock, Star, Dices, Library } from "lucide-react";
import dynamic from "next/dynamic";

const RouletteModal = dynamic(() => import("@/components/RouletteModal").then(mod => mod.RouletteModal), {
    ssr: false,
});
import { ShelfView } from "@/components/ShelfView";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

type SortOption = "score_desc" | "score_asc" | "added_desc" | "added_asc" | "released_desc" | "released_asc" | "rating_desc" | "rating_asc" | "title_asc" | "title_desc" | "vote_desc" | "vote_asc";

export default function Home() {
    const { items, isLoading } = useLibrary();
    const { t } = useLanguage();
    const [filter, setFilter] = useState<GameStatus | "all">("all");
    const [viewMode, setViewMode] = useState<"grid" | "list" | "shelf">("grid");
    const [sort, setSort] = useState<SortOption>("added_desc");
    const [isRouletteOpen, setIsRouletteOpen] = useState(false);

    const statusFilters = useMemo(() => [
        { value: "all", label: t.status.all },
        { value: "playing", label: t.status.playing },
        { value: "completed", label: t.status.completed },
        { value: "watched", label: t.status.watched },
        { value: "plan_to_play", label: t.status.plan_to_play },
        { value: "on_hold", label: t.status.on_hold },
        { value: "dropped", label: t.status.dropped },
    ], [t]);

    const sortOptions = useMemo(() => [
        { value: "added_desc", label: t.sort.added_desc },
        { value: "added_asc", label: t.sort.added_asc },
        { value: "score_desc", label: t.sort.score_desc },
        { value: "score_asc", label: t.sort.score_asc },
        { value: "released_desc", label: t.sort.released_desc },
        { value: "released_asc", label: t.sort.released_asc },
        { value: "rating_desc", label: t.sort.rating_desc },
        { value: "rating_asc", label: t.sort.rating_asc },
        { value: "title_asc", label: t.sort.title_asc },
        { value: "title_desc", label: t.sort.title_desc },
        { value: "vote_desc", label: t.sort.vote_desc },
        { value: "vote_asc", label: t.sort.vote_asc },
    ], [t]);

    const statusCounts = useMemo(() => {
        const counts = {
            all: items.length,
            playing: 0,
            completed: 0,
            watched: 0,
            plan_to_play: 0,
            on_hold: 0,
            dropped: 0,
        };
        items.forEach((item) => {
            if (counts[item.status] !== undefined) {
                counts[item.status]++;
            }
        });
        return counts;
    }, [items]);

    const filteredAndSortedItems = useMemo(() => {
        let result = items;

        // Filter
        if (filter !== "all") {
            result = result.filter((item) => item.status === filter);
        }

        // Sort
        return [...result].sort((a, b) => {
            switch (sort) {
                case "score_desc":
                    return b.score - a.score;
                case "score_asc":
                    return a.score - b.score;
                case "added_desc":
                    return b.addedAt - a.addedAt;
                case "added_asc":
                    return a.addedAt - b.addedAt;
                case "released_desc":
                    return (b.vn.released || "").localeCompare(a.vn.released || "");
                case "released_asc":
                    return (a.vn.released || "").localeCompare(b.vn.released || "");
                case "rating_desc":
                    return (b.vn.rating || 0) - (a.vn.rating || 0);
                case "rating_asc":
                    return (a.vn.rating || 0) - (b.vn.rating || 0);
                case "title_asc":
                    return a.vn.title.localeCompare(b.vn.title);
                case "title_desc":
                    return b.vn.title.localeCompare(a.vn.title);
                case "vote_desc":
                    return (b.vn.votecount || 0) - (a.vn.votecount || 0);
                case "vote_asc":
                    return (a.vn.votecount || 0) - (b.vn.votecount || 0);
                default:
                    return 0;
            }
        });
    }, [items, filter, sort]);

    if (isLoading) {
        return <div className="flex items-center justify-center h-64 text-gray-500">{t.common.loading}</div>;
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
                    <Link href="/search">{t.home.searchButton}</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h1 className="text-3xl font-bold">{t.home.title}</h1>

                    <div className="flex items-center gap-2 flex-wrap">
                        <Button
                            variant="outline"
                            className="gap-2 border-accent/20 text-accent hover:bg-accent/10 hover:text-accent"
                            onClick={() => setIsRouletteOpen(true)}
                        >
                            <Dices className="w-4 h-4" />
                            <span className="hidden sm:inline text-white">{t.home.rouletteButton}</span>
                        </Button>

                        <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
                            <SelectTrigger className="w-[180px] bg-secondary/50 border-white/5">
                                <SelectValue placeholder={t.sort.label} />
                            </SelectTrigger>
                            <SelectContent>
                                {sortOptions.map(option => (
                                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-lg border border-white/5">
                            <Button
                                variant={viewMode === "grid" ? "default" : "ghost"}
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setViewMode("grid")}
                            >
                                <LayoutGrid className="w-4 h-4" />
                            </Button>
                            <Button
                                variant={viewMode === "list" ? "default" : "ghost"}
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setViewMode("list")}
                            >
                                <List className="w-4 h-4" />
                            </Button>
                            <Button
                                variant={viewMode === "shelf" ? "default" : "ghost"}
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setViewMode("shelf")}
                            >
                                <Library className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>

                <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="w-full">
                    <TabsList className="w-full justify-start overflow-x-auto no-scrollbar bg-transparent p-0 h-auto gap-2">
                        {statusFilters.map((f) => (
                            <TabsTrigger
                                key={f.value}
                                value={f.value}
                                className="rounded-full px-4 py-2 data-[state=active]:bg-white data-[state=active]:text-black data-[state=inactive]:bg-secondary data-[state=inactive]:text-gray-400 transition-all"
                            >
                                {f.label}
                                <span className="ml-2 text-xs opacity-70">
                                    ({statusCounts[f.value as keyof typeof statusCounts] || 0})
                                </span>
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
            </div>

            {viewMode === "grid" ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {filteredAndSortedItems.map((item) => (
                        <VNCard
                            key={item.vn.id}
                            vn={item.vn}
                            libraryItem={item}
                        />
                    ))}
                </div>
            ) : viewMode === "list" ? (
                <div className="space-y-2">
                    {filteredAndSortedItems.map((item) => {
                        const isNSFW = (item.vn.image?.sexual === 2) || (item.vn.releases?.some(r => (r.minage ?? 0) >= 18) ?? false);
                        const { nsfwBlur } = useSettings();

                        return (
                            <Link
                                href={`/vn/${item.vn.id}`}
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
                                                isNSFW && nsfwBlur && "blur-md scale-110"
                                            )}
                                        />
                                    )}
                                    {isNSFW && nsfwBlur && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
                                            <Badge variant="destructive" className="bg-red-600/80 text-[8px] h-4 px-1 py-0 border-none">18+</Badge>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-lg truncate group-hover:text-primary transition-colors">{item.vn.title}</h3>
                                    <div className="flex items-center gap-4 text-sm text-gray-400 mt-1">
                                        <div className="flex items-center gap-1">
                                            <Star className="w-3 h-3 text-yellow-500" />
                                            <span className="text-yellow-500 font-bold">{item.score}/100</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Clock className="w-3 h-3 text-green-500" />
                                            <span>{item.playTime ? (item.playTime / 60).toFixed(1) : "0.0"}h</span>
                                        </div>
                                        <Badge variant="secondary" className="text-xs">
                                            {statusFilters.find(f => f.value === item.status)?.label}
                                        </Badge>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            ) : (
                <ShelfView items={filteredAndSortedItems} />
            )}

            <RouletteModal
                isOpen={isRouletteOpen}
                onClose={() => setIsRouletteOpen(false)}
                items={items}
            />
        </div>
    );
}
