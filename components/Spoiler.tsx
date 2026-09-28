"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";
import { getHiddenTags, getVisibleTags, parseSynopsis } from "@/lib/spoiler-safety";
import { VNTag } from "@/types/vndb";

const SPOILER_REVEAL_BUTTON_CLASS =
    "min-h-11 border-white/20 bg-secondary/60 text-gray-200 hover:bg-secondary hover:text-gray-100";

interface SpoilerSynopsisProps {
    description?: string | null;
}

/**
 * あらすじのネタバレ区間を閉じた状態で表示する。
 * 開く前は本文をDOMへ出さない（折り畳み本文をアクセシビリティツリーへ露出させない）。
 * 表示許可はこのコンポーネント内の状態に限定し、親では作品ごとにkeyで作り直す。
 */
export function SpoilerSynopsis({ description }: SpoilerSynopsisProps) {
    const { t } = useLanguage();
    const [revealedKeys, setRevealedKeys] = useState<string[]>([]);
    const segments = parseSynopsis(description);

    return (
        <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
            {segments.length === 0 && t.common.noSynopsis}
            {segments.map((segment, index) => {
                // 保存済みデータから最新情報へ差し替わっても、位置と本文が同じ区間だけを開いたままにする
                const revealKey = `${index}:${segment.text}`;

                if (segment.kind === "text") {
                    return <span key={revealKey}>{segment.text}</span>;
                }

                if (!revealedKeys.includes(revealKey)) {
                    return (
                        <Button
                            key={revealKey}
                            type="button"
                            variant="outline"
                            size="sm"
                            aria-expanded={false}
                            onClick={() => setRevealedKeys((prev) => [...prev, revealKey])}
                            className={`mx-1 ${SPOILER_REVEAL_BUTTON_CLASS}`}
                        >
                            {t.common.showSpoilers}
                        </Button>
                    );
                }

                return (
                    <span key={revealKey} className="rounded bg-secondary/70 px-1 text-gray-200">
                        {segment.text}
                    </span>
                );
            })}
        </p>
    );
}

interface SpoilerTagListProps {
    tags?: VNTag[] | null;
}

/**
 * タグをVNDBのネタバレ区分で分類して表示する。
 * spoiler = 0 以外（1 / 2 / 不明）は既定で隠し、「ネタバレを表示」で明示的に開く。
 */
export function SpoilerTagList({ tags }: SpoilerTagListProps) {
    const { t } = useLanguage();
    const [isRevealed, setIsRevealed] = useState(false);
    const visibleTags = getVisibleTags(tags);
    const hiddenTags = getHiddenTags(tags);

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
                {visibleTags.length === 0 ? (
                    <span className="text-sm text-muted-foreground">{t.common.none}</span>
                ) : (
                    visibleTags.map((tag, index) => (
                        <Badge
                            key={`${tag.id ?? tag.name}-${index}`}
                            variant="secondary"
                            className="bg-primary/10 text-primary hover:bg-primary/20"
                        >
                            {tag.name}
                        </Badge>
                    ))
                )}
            </div>

            {hiddenTags.length > 0 && (
                <div className="space-y-2">
                    {isRevealed ? (
                        <div className="flex flex-wrap gap-2">
                            {hiddenTags.map((tag, index) => (
                                <Badge
                                    key={`${tag.id ?? tag.name}-${index}`}
                                    variant="outline"
                                    className="border-white/15 bg-secondary/40 text-gray-200"
                                >
                                    <span className="rounded bg-background/60 px-1 text-[10px] font-normal text-muted-foreground">
                                        {t.common.spoilerTag}
                                    </span>
                                    {tag.name}
                                </Badge>
                            ))}
                        </div>
                    ) : (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                aria-expanded={false}
                                onClick={() => setIsRevealed(true)}
                                className={SPOILER_REVEAL_BUTTON_CLASS}
                            >
                                {t.common.showSpoilers} ({hiddenTags.length})
                            </Button>
                            <p className="text-xs text-muted-foreground">{t.vn.spoilerTagNote}</p>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
