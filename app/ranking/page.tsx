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

export default function RankingPage() {
    const { items } = useLibrary();
    const { t } = useLanguage();
    const { nsfwBlur } = useSettings();

    const rankedItems = useMemo(() => {
        return [...items]
            .filter((item) => item.score !== null)
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    }, [items]);

    if (rankedItems.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
                <Trophy className="w-16 h-16 text-gray-600" />
                <h2 className="text-2xl font-bold">{t.ranking.emptyTitle}</h2>
                <p className="text-gray-400">{t.ranking.emptyDesc}</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold">{t.ranking.title}</h1>
                <p className="text-gray-400">{t.ranking.subtitle}</p>
            </div>

            <div className="space-y-4 max-w-4xl mx-auto">
                {rankedItems.map((item, index) => (
                    <Link
                        href={`/vn/${item.vn.id}`}
                        key={item.vn.id}
                        className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors group"
                    >
                        <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center font-bold text-2xl text-gray-500 group-hover:text-primary">
                            #{index + 1}
                        </div>

                        <div className="flex-shrink-0 w-16 h-24 rounded-lg overflow-hidden relative">
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

                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-lg truncate group-hover:text-primary transition-colors">{item.vn.title}</h3>
                            <div className="flex gap-2 mt-1">
                                {getVisibleTags(item.vn.tags).slice(0, 3).map(tag => (
                                    <span key={tag.id} className="text-xs px-2 py-0.5 rounded-full bg-secondary text-gray-400">
                                        {tag.name}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="flex-shrink-0 text-right px-4">
                            <div className="text-3xl font-bold text-yellow-500">{item.score}</div>
                            <div className="text-xs text-gray-500">{t.common.score}</div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
