"use client";

import { useLibrary } from "@/context/LibraryContext";
import { useMemo } from "react";
import { ImageOff, Trophy } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { useSettings } from "@/context/SettingsContext";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { shouldBlurImage } from "@/lib/image-safety";
import { getVisibleTags } from "@/lib/spoiler-safety";
import { getDisplayTitle } from "@/lib/vndb-title";
import { rankLibraryItems } from "@/lib/ranking";

export default function RankingPage() {
    const { items, isLoading, loadError, reloadLibrary } = useLibrary();
    const { language, t } = useLanguage();
    const { nsfwBlur } = useSettings();

    const rankedItems = useMemo(() => rankLibraryItems(items), [items]);

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <header className="space-y-1">
                <h1 className="text-3xl font-bold">{t.ranking.title}</h1>
                {!isLoading && !loadError && (
                    <p data-testid="ranking-rated-count" className="text-sm text-muted-foreground">
                        {t.stats.ratedCount.replace("{count}", String(rankedItems.length))}
                    </p>
                )}
                <p className="text-sm text-muted-foreground">{t.ranking.subtitle}</p>
            </header>

            {isLoading ? (
                <div className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground" role="status" aria-live="polite" aria-busy="true">
                    {t.common.loading}
                </div>
            ) : loadError ? (
                <div className="space-y-4 rounded-xl border border-destructive/40 bg-card p-6 text-center" role="alert">
                    <div className="space-y-1">
                        <h2 className="text-xl font-semibold">{t.home.loadErrorTitle}</h2>
                        <p className="text-sm text-muted-foreground">{t.home.loadErrorDesc}</p>
                    </div>
                    <Button className="min-h-11" onClick={() => void reloadLibrary().catch(() => undefined)}>
                        {t.home.retryLoad}
                    </Button>
                </div>
            ) : rankedItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center space-y-4 rounded-xl border border-border bg-card px-6 py-12 text-center">
                    <Trophy className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
                    <div className="space-y-1">
                        <h2 className="text-xl font-bold">{t.ranking.emptyTitle}</h2>
                        <p className="text-sm text-muted-foreground">{t.ranking.emptyDesc}</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    {rankedItems.map(({ item, rank }) => {
                        const title = getDisplayTitle(item.vn, language);
                        const shouldBlur = shouldBlurImage(item.vn.image?.sexual, nsfwBlur);

                        return (
                            <Link
                                href={`/vn/${item.vn.id}`}
                                aria-label={title}
                                data-testid="ranking-row"
                                key={item.vn.id}
                                className="group grid min-h-11 grid-cols-[2rem_2.5rem_minmax(0,1fr)] items-center gap-x-2 gap-y-2 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 lg:flex lg:gap-4 lg:p-4"
                            >
                                <div data-testid="ranking-rank" className="flex h-8 w-8 shrink-0 items-center justify-center font-bold text-base text-muted-foreground group-hover:text-primary lg:h-12 lg:w-12 lg:text-2xl">
                                    #{rank}
                                </div>

                                <div className="relative h-[60px] w-10 shrink-0 overflow-hidden rounded-md bg-muted lg:h-[72px] lg:w-12">
                                    {item.vn.image ? (
                                        <>
                                            <img
                                                src={item.vn.image.url}
                                                alt=""
                                                className={cn(
                                                    "h-full w-full object-cover transition-all",
                                                    shouldBlur && "scale-110 blur-md",
                                                )}
                                            />
                                            {shouldBlur && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
                                                    <Badge variant="destructive" className="h-auto max-w-full whitespace-normal break-words border-none bg-destructive/80 px-1 py-0.5 text-center text-[8px] leading-3">
                                                        {t.settings.imageBlurred}
                                                    </Badge>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center text-muted-foreground" aria-hidden="true">
                                            <ImageOff className="h-4 w-4" />
                                        </div>
                                    )}
                                </div>

                                <div className="min-w-0 lg:flex-1">
                                    <h2 data-testid="ranking-title" className="line-clamp-2 break-words text-base font-bold [overflow-wrap:anywhere] transition-colors group-hover:text-primary sm:text-lg">
                                        {title}
                                    </h2>
                                    {item.vn.developers?.[0]?.name && (
                                        <p className="truncate text-xs text-muted-foreground">{item.vn.developers[0].name}</p>
                                    )}
                                </div>

                                <div className="col-span-3 flex min-w-0 items-center gap-x-3 gap-y-2 lg:contents">
                                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                                        <p data-testid="ranking-status" className="shrink-0 text-xs text-muted-foreground">{t.status[item.status]}</p>
                                        {getVisibleTags(item.vn.tags).slice(0, 3).map((tag) => (
                                            <span key={tag.id} className="max-w-full break-words rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                                                {tag.name}
                                            </span>
                                        ))}
                                    </div>

                                    <div className="ml-auto shrink-0 text-right lg:px-2">
                                        <div data-testid="ranking-score" className="text-2xl font-bold text-primary lg:text-3xl">{item.score}</div>
                                        <div data-testid="ranking-score-label" className="text-xs text-muted-foreground">{t.common.score}</div>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
