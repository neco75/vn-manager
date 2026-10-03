"use client";

import { LibraryItem } from "@/types/library";
import Link from "next/link";
import { useSettings } from "@/context/SettingsContext";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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
        <div className="relative overflow-hidden rounded-xl border border-border bg-secondary p-3 shadow-2xl sm:p-6 lg:p-8">
            {/* Wood Texture Overlay */}
            <div className="absolute inset-0 opacity-5 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]" />

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-0">
                {items.map((item) => {
                    const shouldBlur = shouldBlurImage(item.vn.image?.sexual, nsfwBlur);
                    const displayTitle = getDisplayTitle(item.vn, language);
                    const detailHref = returnTo
                        ? `/vn/${item.vn.id}?from=${encodeURIComponent(returnTo)}`
                        : `/vn/${item.vn.id}`;

                    return (
                        <div key={item.vn.id} className="relative group">
                            {/* Shelf Structure (The 'box' for each item) */}
                            <div className="relative z-10 flex h-full flex-col items-center border-b-[12px] border-border bg-gradient-to-b from-transparent via-transparent to-background/70 px-2 pt-5 pb-2 sm:px-3 sm:pt-8 lg:px-4">

                                <div className="relative w-full">
                                    {/* The Game Case */}
                                    <Link href={detailHref} aria-label={displayTitle} className="relative block w-full aspect-[2/3] transition-transform duration-300 group-hover:-translate-y-2 group-hover:scale-105 z-20 origin-bottom overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2">
                                        {item.vn.image ? (
                                            <img
                                                src={item.vn.image.url}
                                                alt={displayTitle}
                                                className={cn(
                                                    "w-full h-full object-cover rounded-sm shadow-md group-hover:shadow-xl transition-all",
                                                    shouldBlur && "blur-xl scale-110"
                                                )}
                                            />
                                        ) : (
                                            <div data-testid="shelf-no-image-label" className="flex h-full w-full items-center justify-center bg-card px-2 text-center text-xs text-foreground">
                                                {t.common.noImage}
                                            </div>
                                        )}

                                        {item.vn.image && shouldBlur && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
                                                <Badge variant="destructive" className="bg-destructive/80 text-[8px] h-4 px-1 py-0 border-none">{t.settings.imageBlurred}</Badge>
                                            </div>
                                        )}

                                        {/* Spine/Side effect (pseudo 3D) */}
                                        <div className="absolute top-0 right-0 h-full w-[2px] bg-border" />
                                        <div className="absolute top-0 left-0 h-full w-px bg-primary/20" />

                                        {/* Reflection on the shelf */}
                                    <div className="absolute top-full left-0 h-12 w-full scale-y-[-1] bg-gradient-to-b from-primary/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-30 mask-image-linear-gradient" style={{ WebkitMaskImage: 'linear-gradient(to bottom, black, transparent)' }} />
                                    </Link>

                                    {/* Shadow under the book */}
                                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-[90%] h-4 bg-black/60 blur-md rounded-[100%] z-0 group-hover:w-[80%] group-hover:opacity-40 transition-all" />
                                </div>

                                <Link href={detailHref} data-testid="shelf-title-link" className="mt-2 w-full break-words rounded-sm px-1 py-1 text-center text-sm font-medium leading-snug text-foreground hover:text-primary [overflow-wrap:anywhere] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2">
                                    {displayTitle}
                                </Link>
                            </div>

                            {/* Vertical Divider (optional, maybe distracting) */}
                            {/* <div className="absolute top-0 right-0 w-[1px] h-full bg-white/5" /> */}
                        </div>
                    );
                })}

                {/* Fill empty slots in the last row to complete the shelf look if needed */}
                {/* Actually, grid handles this well, the border-b will just stop. 
            To make it look like a continuous shelf, we might want to fill the rest of the row?
            CSS Grid doesn't easily let us fill 'rest of row'. 
            But with gap-0, the shelf just ends at the last item. That's acceptable.
        */}
            </div>
        </div>
    );
}
