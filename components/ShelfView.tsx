"use client";

import { LibraryItem } from "@/types/library";
import Link from "next/link";
import { useSettings } from "@/context/SettingsContext";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";
import { shouldBlurImage } from "@/lib/image-safety";
import { getDisplayTitle } from "@/lib/vndb-title";

interface ShelfViewProps {
    items: LibraryItem[];
    returnTo?: string;
}

export function ShelfView({ items, returnTo }: ShelfViewProps) {
    const { nsfwBlur } = useSettings();
    const { language, t } = useLanguage();

    return (
        <div className="rounded-xl border border-border bg-card p-3 sm:p-5">
            <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                {items.map((item) => {
                    const shouldBlur = shouldBlurImage(item.vn.image?.sexual, nsfwBlur);
                    const displayTitle = getDisplayTitle(item.vn, language);
                    const detailHref = returnTo
                        ? `/vn/${item.vn.id}?from=${encodeURIComponent(returnTo)}`
                        : `/vn/${item.vn.id}`;

                    return (
                        <article key={item.vn.id} className="min-w-0 border-b border-border pb-3">
                            <Link
                                href={detailHref}
                                aria-label={displayTitle}
                                className="relative block aspect-[2/3] w-full overflow-hidden rounded-md border border-border bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                            >
                                {item.vn.image ? (
                                    <img
                                        src={item.vn.image.url}
                                        alt={displayTitle}
                                        className={cn("h-full w-full object-cover", shouldBlur && "scale-110 blur-xl")}
                                    />
                                ) : (
                                    <span data-testid="shelf-no-image-label" className="flex h-full w-full items-center justify-center px-2 text-center text-sm text-muted-foreground">
                                        {t.common.noImage}
                                    </span>
                                )}

                                {item.vn.image && shouldBlur && (
                                    <span className="absolute inset-0 flex items-center justify-center bg-background/80 px-2 text-center text-[13px] leading-4 text-foreground">
                                        {t.settings.imageBlurred}
                                    </span>
                                )}
                            </Link>

                            <Link
                                href={detailHref}
                                data-testid="shelf-title-link"
                                className="mt-2 block min-h-11 w-full break-words rounded-sm px-1 py-1 text-center text-sm font-medium leading-5 text-foreground hover:text-primary [overflow-wrap:anywhere] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                            >
                                {displayTitle}
                            </Link>
                        </article>
                    );
                })}
            </div>
        </div>
    );
}
