import { VN } from "@/types/vndb";
import Image from "next/image";
import { LibraryItem } from "@/types/library";
import { cn } from "@/lib/utils";
import { Star, Calendar, Plus, Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { shouldBlurImage } from "@/lib/image-safety";
import { getDisplayTitle } from "@/lib/vndb-title";

interface VNCardProps {
    vn: VN;
    libraryItem?: LibraryItem;
    className?: string;
    /** 検索結果として表示（発売年・VNDB評価・ブランドと追加操作を含める） */
    variant?: "library" | "search";
    /** 追加操作。渡すと検索カードに独立した「追加」ボタンを出す */
    onAdd?: () => void;
    /** 追加処理の進行中（渡された追加操作の状態） */
    isAdding?: boolean;
}

import { useLanguage } from "@/context/LanguageContext";
import { useSettings } from "@/context/SettingsContext";

export function VNCard({ vn, libraryItem, className, variant = "library", onAdd, isAdding = false }: VNCardProps) {
    const { language, t } = useLanguage();
    const { nsfwBlur } = useSettings();

    const shouldBlur = shouldBlurImage(vn.image?.sexual, nsfwBlur);
    const isSearch = variant === "search";
    const isAdded = Boolean(libraryItem);
    const displayTitle = getDisplayTitle(vn, language);
    const developerName = vn.developers?.[0]?.name;

    // 表紙とタイトルは詳細へ移動する主リンク。追加などの操作はリンク外に置く（入れ子にしない）。
    const Cover = (
        <Link href={`/vn/${vn.id}`} className="block" aria-label={displayTitle}>
            <div className="aspect-[2/3] relative overflow-hidden bg-card">
                {vn.image ? (
                    <>
                        <Image
                            src={vn.image.url}
                            alt={displayTitle}
                            fill
                            className={cn(
                                "object-contain transition-all duration-300",
                                shouldBlur && "blur-xl scale-110"
                            )}
                            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
                        />
                        {shouldBlur && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                                <Badge variant="destructive" className="bg-red-600/80 text-white border-none shadow-lg">{t.settings.imageBlurred}</Badge>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="w-full h-full bg-secondary flex items-center justify-center text-muted-foreground text-sm px-2 text-center">
                        {t.common.noImage}
                    </div>
                )}
            </div>
        </Link>
    );

    const isRated = vn.rating !== null && vn.rating !== undefined && vn.rating > 0;

    return (
        <Card
            className={cn("h-full overflow-hidden border-border rounded-xl p-0 gap-0 flex flex-col", className)}
        >
            {Cover}

            <CardContent className="p-4 space-y-2 flex-1 flex flex-col">
                <Link
                    href={`/vn/${vn.id}`}
                    className="min-h-[2.75rem] font-bold text-base leading-snug line-clamp-2 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                    {displayTitle}
                </Link>

                {developerName && <p className="truncate text-xs text-muted-foreground">{developerName}</p>}

                {/* 補助情報: 検索カードはブランド・発売年・VNDB評価、ライブラリカードは自分の記録 */}
                {isSearch ? (
                    <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-3">
                            <span className="inline-flex items-center gap-1">
                                <Calendar className="w-3 h-3" aria-hidden="true" />
                                {vn.released || "TBA"}
                            </span>
                            {isRated && (
                                <span className="inline-flex items-center gap-1">
                                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" aria-hidden="true" />
                                    VNDB {(vn.rating / 10).toFixed(1)}/10
                                </span>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" aria-hidden="true" />
                            <span>{isRated ? (vn.rating / 10).toFixed(1) : "N/A"}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" aria-hidden="true" />
                            <span>{vn.released || "TBA"}</span>
                        </div>
                    </div>
                )}

                <div className="mt-auto pt-2 space-y-2">
                    {libraryItem ? (
                        <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
                            <Badge variant="secondary" className="text-xs">
                                {isSearch ? t.search.alreadyAdded : t.status[libraryItem.status]}
                            </Badge>
                            {!isSearch && libraryItem.ownership !== "unknown" && (
                                <Badge variant="outline" className="text-xs">
                                    {t.ownership[libraryItem.ownership]}
                                </Badge>
                            )}
                        </div>
                    ) : null}

                    {!isSearch && libraryItem && libraryItem.score !== null ? (
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">{t.common.score}</span>
                            <span className="text-sm font-bold text-yellow-500">{libraryItem.score}/100</span>
                        </div>
                    ) : null}

                    {/* 追加操作: 未登録なら既定でプレイ予定として追加。登録済みは「登録済み」表示のみ */}
                    {isSearch && !isAdded && onAdd ? (
                        <button
                            type="button"
                            onClick={onAdd}
                            disabled={isAdding}
                            className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                        >
                            {isAdding ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Plus className="w-4 h-4" aria-hidden="true" />}
                            {t.common.addToLibrary}
                        </button>
                    ) : null}
                    {isSearch && isAdded ? (
                        <div className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-md border border-border px-3 text-sm text-muted-foreground">
                            <Check className="w-4 h-4 text-green-400" aria-hidden="true" />
                            {t.search.alreadyAdded}
                        </div>
                    ) : null}
                </div>
            </CardContent>
        </Card>
    );
}
