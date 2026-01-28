"use client";

import { LibraryItem } from "@/types/library";
import Link from "next/link";
import { motion } from "framer-motion";
import { useSettings } from "@/context/SettingsContext";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface ShelfViewProps {
    items: LibraryItem[];
}

export function ShelfView({ items }: ShelfViewProps) {
    const { nsfwBlur } = useSettings();
    return (
        <div className="bg-[#1a1512] p-8 rounded-xl border border-[#3d2b1f] shadow-2xl overflow-hidden relative">
            {/* Wood Texture Overlay */}
            <div className="absolute inset-0 opacity-5 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]" />

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-0">
                {items.map((item, index) => {
                    const isNSFW = (item.vn.image?.sexual === 2) || (item.vn.releases?.some(r => (r.minage ?? 0) >= 18) ?? false);

                    return (
                        <div key={item.vn.id} className="relative group">
                            {/* Shelf Structure (The 'box' for each item) */}
                            <div className="pt-8 pb-2 px-4 border-b-[12px] border-[#3d2b1f] bg-gradient-to-b from-transparent via-transparent to-black/40 relative z-10 h-full flex items-end justify-center">

                                {/* The Game Case */}
                                <Link href={`/vn/${item.vn.id}`} className="relative block w-full aspect-[2/3] transition-transform duration-300 group-hover:-translate-y-2 group-hover:scale-105 z-20 origin-bottom overflow-hidden">
                                    {item.vn.image ? (
                                        <img
                                            src={item.vn.image.url}
                                            alt={item.vn.title}
                                            className={cn(
                                                "w-full h-full object-cover rounded-sm shadow-md group-hover:shadow-xl transition-all",
                                                isNSFW && nsfwBlur && "blur-xl scale-110"
                                            )}
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-gray-800 flex items-center justify-center text-xs text-gray-500">
                                            No Image
                                        </div>
                                    )}

                                    {isNSFW && nsfwBlur && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
                                            <Badge variant="destructive" className="bg-red-600/80 text-[8px] h-4 px-1 py-0 border-none">18+</Badge>
                                        </div>
                                    )}

                                    {/* Spine/Side effect (pseudo 3D) */}
                                    <div className="absolute top-0 right-0 w-[2px] h-full bg-white/20" />
                                    <div className="absolute top-0 left-0 w-[1px] h-full bg-black/20" />

                                    {/* Reflection on the shelf */}
                                    <div className="absolute top-full left-0 w-full h-12 bg-gradient-to-b from-white/10 to-transparent opacity-0 group-hover:opacity-30 transition-opacity duration-300 scale-y-[-1] mask-image-linear-gradient" style={{ WebkitMaskImage: 'linear-gradient(to bottom, black, transparent)' }} />
                                </Link>

                                {/* Shadow under the book */}
                                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[90%] h-4 bg-black/60 blur-md rounded-[100%] z-0 group-hover:w-[80%] group-hover:opacity-40 transition-all" />
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
