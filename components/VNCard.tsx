"use client";

import { useState } from "react";
import { Calendar, Check, Loader2, Plus, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { shouldBlurImage } from "@/lib/image-safety";
import { cn } from "@/lib/utils";
import { getDisplayTitle } from "@/lib/vndb-title";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/context/LanguageContext";
import { useSettings } from "@/context/SettingsContext";
import { LibraryItem } from "@/types/library";
import { VN } from "@/types/vndb";

interface VNCardProps {
    vn: VN;
    libraryItem?: LibraryItem;
    className?: string;
    /** 検索結果として表示（発売年・VNDB評価と追加操作を含める） */
    variant?: "library" | "search";
    /** 追加操作。渡すと検索カードに独立した「追加」ボタンを出す */
    onAdd?: () => void;
    /** 追加処理の進行中（渡された追加操作の状態） */
    isAdding?: boolean;
    /** 詳細ページから戻るためのアプリ内URLを含むリンク */
    detailHref?: string;
    /** 詳細へのアプリ内リンクを押したときに呼び出す */
    onDetailClick?: () => void;
}

export function VNCard({
    vn,
    libraryItem,
    className,
    variant = "library",
    onAdd,
    isAdding = false,
    detailHref,
    onDetailClick,
}: VNCardProps) {
    const { language, t } = useLanguage();
    const { nsfwBlur } = useSettings();
    const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);

    const shouldBlur = shouldBlurImage(vn.image?.sexual, nsfwBlur);
    const isSearch = variant === "search";
    const isAdded = Boolean(libraryItem);
    const displayTitle = getDisplayTitle(vn, language);
    const developerName = vn.developers?.[0]?.name;
    const imageUrl = vn.image?.url;
    const showImage = Boolean(imageUrl) && failedImageUrl !== imageUrl;
    const href = detailHref ?? `/vn/${vn.id}`;
    const isRated = vn.rating !== null && vn.rating !== undefined && vn.rating > 0;

    const cover = (
        <div className="relative aspect-[3/2] w-full overflow-hidden bg-card">
            {showImage && imageUrl ? (
                <>
                    <Image
                        src={imageUrl}
                        alt=""
                        fill
                        onError={() => setFailedImageUrl(imageUrl)}
                        className={cn("object-contain", shouldBlur && "blur-xl")}
                        sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 20vw"
                    />
                    {shouldBlur && (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                            <Badge variant="destructive" className="max-w-full whitespace-normal break-words border-none bg-destructive/80 px-1.5 text-center text-[13px] leading-[1.5] text-destructive-foreground shadow-lg">
                                <span className="min-w-0 break-words text-center">{t.settings.imageBlurred}</span>
                            </Badge>
                        </div>
                    )}
                </>
            ) : (
                <div className="flex h-full w-full items-center justify-center bg-secondary px-2 text-center text-[13px] leading-[1.5] text-muted-foreground">
                    {t.common.noImage}
                </div>
            )}
        </div>
    );

    const cardText = (
        <div className="flex min-w-0 flex-1 flex-col gap-2 p-2 sm:p-4">
            <span className="line-clamp-2 min-h-[2.625rem] break-words text-sm font-semibold leading-[1.5] text-foreground hover:text-primary sm:text-base">
                {displayTitle}
            </span>
            {developerName && (
                <span className="truncate text-[13px] leading-[1.5] text-muted-foreground">
                    {developerName}
                </span>
            )}

            {isSearch ? (
                <div className="mt-auto flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[13px] leading-[1.5] text-muted-foreground">
                    <span className="inline-flex items-center gap-1 tabular-nums">
                        <Calendar className="h-3 w-3 shrink-0" aria-hidden="true" />
                        {vn.released || "TBA"}
                    </span>
                    {isRated && (
                        <span className="inline-flex items-center gap-1 tabular-nums">
                            <Star className="h-3 w-3 shrink-0 fill-primary text-primary" aria-hidden="true" />
                            VNDB {(vn.rating / 10).toFixed(1)}/10
                        </span>
                    )}
                </div>
            ) : libraryItem ? (
                <div className="mt-auto flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 pt-1">
                    <Badge variant="secondary" className="max-w-full whitespace-normal break-words text-[13px] leading-[1.5]">
                        {t.status[libraryItem.status]}
                    </Badge>
                    <span className="ml-auto shrink-0 text-sm font-semibold tabular-nums text-primary">
                        {libraryItem.score === null ? t.common.unrated : `${libraryItem.score}/100`}
                    </span>
                </div>
            ) : null}
        </div>
    );

    const mainLink = (
        <Link
            href={href}
            aria-label={displayTitle}
            onClick={onDetailClick}
            className={cn(
                "group flex min-w-0 flex-1 flex-col rounded-t-xl outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                !isSearch && cn("h-full overflow-hidden rounded-xl border border-border bg-card shadow-[0_2px_10px_rgba(28,33,64,0.04)] transition-colors duration-150 hover:border-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background", className),
            )}
        >
            {cover}
            {cardText}
        </Link>
    );

    if (!isSearch) return <>{mainLink}</>;

    return (
        <Card className={cn("h-full min-w-0 gap-0 overflow-hidden rounded-xl border-border bg-card p-0 shadow-[0_2px_10px_rgba(28,33,64,0.04)]", className)}>
            {mainLink}
            {isAdded ? (
                <div className="flex min-h-11 items-center gap-1.5 px-2 pb-2 text-sm text-muted-foreground sm:px-4 sm:pb-4">
                    <Check className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                    {t.search.alreadyAdded}
                </div>
            ) : onAdd ? (
                <div className="px-2 pb-2 sm:px-4 sm:pb-4">
                    <button
                        type="button"
                        onClick={onAdd}
                        disabled={isAdding}
                        aria-busy={isAdding}
                        className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-md bg-primary px-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 sm:px-3"
                    >
                        {isAdding ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />}
                        <span className="min-w-0 break-words text-center leading-tight">{t.common.addToLibrary}</span>
                    </button>
                </div>
            ) : null}
        </Card>
    );
}
