import { VN } from "@/types/vndb";
import Image from "next/image";
import { LibraryItem } from "@/types/library";
import { cn } from "@/lib/utils";
import { Star, Calendar } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface VNCardProps {
    vn: VN;
    libraryItem?: LibraryItem;
    onClick?: () => void;
    className?: string;
    index?: number;
}

const MotionCard = motion.create(Card);

import { useLanguage } from "@/context/LanguageContext";
import { useSettings } from "@/context/SettingsContext";

export function VNCard({ vn, libraryItem, onClick, className, index = 0 }: VNCardProps) {
    const { t } = useLanguage();
    const { nsfwBlur } = useSettings();

    const isNSFW = (vn.image?.sexual === 2) || (vn.releases?.some(r => (r.minage ?? 0) >= 18) ?? false);
    const shouldBlur = isNSFW && nsfwBlur;

    const Content = (
        <MotionCard
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.05 }}
            className={cn(
                "group h-full overflow-hidden border-white/10 hover:border-primary/50 transition-colors cursor-pointer p-0 gap-0",
                className
            )}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
        >
            <div className="aspect-[2/3] relative overflow-hidden">
                {vn.image ? (
                    <motion.div
                        className="w-full h-full relative"
                        whileHover={{ scale: 1.1 }}
                        transition={{ duration: 0.5 }}
                    >
                        <Image
                            src={vn.image.url}
                            alt={vn.title}
                            fill
                            className={cn(
                                "object-cover transition-all duration-300",
                                shouldBlur && "blur-xl scale-110"
                            )}
                            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
                        />
                        {shouldBlur && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                                <Badge variant="destructive" className="bg-red-600/80 text-white border-none shadow-lg">18+</Badge>
                            </div>
                        )}
                    </motion.div>
                ) : (
                    <div className="w-full h-full bg-secondary flex items-center justify-center text-muted-foreground">
                        {t.common.noImage}
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                    <p className="text-sm text-gray-300 line-clamp-3">{vn.description?.replace(/\[.*?\]/g, "")}</p>
                </div>
                {libraryItem && (
                    <Badge variant="secondary" className="absolute top-2 right-2 bg-black/70 backdrop-blur-md text-white border-white/10 shadow-lg hover:bg-black/80">
                        {t.status[libraryItem.status]}
                    </Badge>
                )}
            </div>

            <CardContent className="p-4 space-y-2">
                <h3 className="font-bold text-lg leading-tight line-clamp-1 group-hover:text-primary transition-colors">
                    {vn.title}
                </h3>

                <div className="flex items-center justify-between text-xs text-gray-400">
                    <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        <span>{vn.rating ? (vn.rating / 10).toFixed(1) : "N/A"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{vn.released || "TBA"}</span>
                    </div>
                </div>

                {libraryItem?.score ? (
                    <div className="mt-2 pt-2 border-t border-white/10 flex justify-between items-center">
                        <span className="text-xs text-gray-400">{t.common.score}</span>
                        <span className="text-sm font-bold text-yellow-500">{libraryItem.score}/100</span>
                    </div>
                ) : null}
            </CardContent>
        </MotionCard>
    );

    if (onClick) return <div onClick={onClick}>{Content}</div>;

    return (
        <Link href={`/vn/${vn.id}`}>
            {Content}
        </Link>
    );
}
