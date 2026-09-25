"use client";

import { useLibrary } from "@/context/LibraryContext";
import { useMemo } from "react";
import { Trophy } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { useSettings } from "@/context/SettingsContext";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { shouldBlurImage } from "@/lib/image-safety";
import { getVisibleTags } from "@/lib/spoiler-safety";
import { getDisplayTitle } from "@/lib/vndb-title";
import { rankLibraryItems } from "@/lib/ranking";

export default function RankingPage() {
    const { items } = useLibrary();
    const { language, t } = useLanguage();
    const { nsfwBlur } = useSettings();

    const rankedItems = useMemo(() => {
        return rankLibraryItems(items);
    }, [items]);

    return (
        <div className="space-y-8">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold">{t.ranking.title}</h1>
                <p className="text-gray-400">{t.ranking.subtitle}</p>
            </div>

            {rankedItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4">
                    <Trophy className="w-16 h-16 text-gray-600" />
                    <h2 className="text-2xl font-bold">{t.ranking.emptyTitle}</h2>
                    <p className="text-gray-400">{t.ranking.emptyDesc}</p>
                </div>
            ) : (
                <div className="space-y-4 max-w-4xl mx-auto">
                    {rankedItems.map(({ item, rank }) => (
                        <Link
                            href={`/vn/${item.vn.id}`}
                            aria-label={getDisplayTitle(item.vn, language)}
                            key={item.vn.id}
                            className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 p-3 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors group focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 lg:flex lg:gap-4 lg:p-4"
                        >
                            <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center font-bold text-xl text-gray-500 group-hover:text-primary lg:text-2xl">
                                #{rank}
                            </div>

                            <div className="flex-shrink-0 w-8 h-12 md:w-12 md:h-[4.5rem] lg:w-16 lg:h-24 rounded-lg overflow-hidden relative">
                                {item.vn.image && (
                                    <>
                                        <img
                                            src={item.vn.image.url}
                                            alt=""
                                            className={cn(
                                                "w-full h-full object-cover transition-all",
                                                shouldBlurImage(item.vn.image?.sexual, nsfwBlur) && "blur-md scale-110"
                                            )}
                                        />
                                        {shouldBlurImage(item.vn.image?.sexual, nsfwBlur) && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
                                                <Badge variant="destructive" className="bg-red-600/80 text-[8px] h-4 px-1 py-0 border-none">{t.settings.imageBlurred}</Badge>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            <div className="min-w-0 lg:flex-1">
                                <h3 data-testid="ranking-title" className="font-bold text-base sm:text-lg break-words [overflow-wrap:anywhere] group-hover:text-primary transition-colors">{getDisplayTitle(item.vn, language)}</h3>
                                {item.vn.developers?.[0]?.name && (
                                    <p className="truncate text-xs text-muted-foreground">{item.vn.developers[0].name}</p>
                                )}
                            </div>

                            <div className="col-span-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 lg:contents">
                                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                                    <p className="shrink-0 text-xs text-gray-500">{t.status[item.status]}</p>
                                    {getVisibleTags(item.vn.tags).slice(0, 3).map(tag => (
                                        <span key={tag.id} className="max-w-full break-words [overflow-wrap:anywhere] text-xs px-2 py-0.5 rounded-full bg-secondary text-gray-400">
                                            {tag.name}
                                        </span>
                                    ))}
                                </div>

                                <div className="ml-auto flex-shrink-0 text-right lg:px-4">
                                    <div data-testid="ranking-score" className="text-2xl font-bold text-yellow-500 lg:text-3xl">{item.score}</div>
                                    <div className="text-xs text-gray-500">{t.common.score}</div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
