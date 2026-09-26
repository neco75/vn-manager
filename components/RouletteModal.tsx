"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { Dices, Sparkles } from "lucide-react";
import { LibraryItem } from "@/types/library";
import Link from "next/link";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";
import { useSettings } from "@/context/SettingsContext";
import { shouldBlurImage } from "@/lib/image-safety";
import { cn } from "@/lib/utils";
import { getDisplayTitle } from "@/lib/vndb-title";

interface RouletteModalProps {
    isOpen: boolean;
    onClose: () => void;
    items: LibraryItem[];
}

export function RouletteModal({ isOpen, onClose, items }: RouletteModalProps) {
    const { language, t } = useLanguage();
    const { nsfwBlur } = useSettings();
    const reduceMotion = useReducedMotion();
    const [spinning, setSpinning] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [winner, setWinner] = useState<LibraryItem | null>(null);

    // Filter only "plan_to_play" items, or use all if none are planned
    const pool = items.filter(i => i.status === "plan_to_play").length > 0
        ? items.filter(i => i.status === "plan_to_play")
        : items;

    useEffect(() => {
        if (isOpen) {
            const timeoutId = window.setTimeout(() => {
                setWinner(null);
                setSpinning(false);
                setCurrentIndex(0);
            }, 0);
            return () => window.clearTimeout(timeoutId);
        }
    }, [isOpen]);

    const handleSpin = () => {
        if (pool.length === 0) return;
        setSpinning(true);
        setWinner(null);

        const winningIndex = Math.floor(Math.random() * pool.length);
        if (reduceMotion) {
            setCurrentIndex(winningIndex);
            setWinner(pool[winningIndex]);
            setSpinning(false);
            return;
        }

        const totalDuration = 3000; // 3 seconds
        const intervalTime = 100;
        const startTime = Date.now();

        const interval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            if (elapsed < totalDuration) {
                setCurrentIndex(prev => (prev + 1) % pool.length);
            } else {
                clearInterval(interval);
                setSpinning(false);
                setWinner(pool[winningIndex]);
                setCurrentIndex(winningIndex);
            }
        }, intervalTime);
    };

    const currentItem = pool[currentIndex];
    const currentTitle = currentItem ? getDisplayTitle(currentItem.vn, language) : "";
    const shouldBlurCurrentImage = shouldBlurImage(currentItem?.vn.image?.sexual, nsfwBlur);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-lg bg-[#0a0a0a] border-white/10">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-center gap-2 text-2xl font-bold">
                        <Dices className="w-6 h-6 text-primary" />
                        {t.roulette.title}
                    </DialogTitle>
                    <DialogDescription className="text-center text-muted-foreground">
                        {t.roulette.desc.replace("{count}", pool.length.toString())}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col items-center space-y-8 py-4">
                    <div className="relative w-48 h-64 sm:w-56 sm:h-80 rounded-xl overflow-hidden bg-secondary shadow-2xl border-2 border-white/10">
                        {currentItem?.vn.image ? (
                            <Image
                                src={currentItem.vn.image.url}
                                alt={currentTitle}
                                fill
                                className={cn("object-cover transition-all", shouldBlurCurrentImage && "blur-xl scale-110")}
                                sizes="(max-width: 640px) 192px, 224px"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                {t.common.noImage}
                            </div>
                        )}

                        {shouldBlurCurrentImage && currentItem?.vn.image && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20">
                                <span className="rounded bg-black/70 px-2 py-1 text-xs text-white">{t.settings.imageBlurred}</span>
                            </div>
                        )}

                        {/* Overlay for spinning effect */}
                        {spinning && (
                            <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" />
                        )}
                    </div>

                    <div className="space-y-2 text-center w-full">
                        <h3 className="text-xl font-bold px-4 line-clamp-2 min-h-[3.5rem] flex items-center justify-center">
                            {currentTitle || "No Games Found"}
                        </h3>
                        {winner && (
                            <motion.div
                                data-testid="roulette-winner"
                                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: reduceMotion ? 0 : 0.2 }}
                                className="text-primary font-bold flex items-center justify-center gap-2"
                            >
                                <Sparkles className="w-4 h-4" />
                                {t.roulette.winner}
                            </motion.div>
                        )}
                    </div>

                    <div className="flex justify-center w-full">
                        {!winner ? (
                            <Button
                                onClick={handleSpin}
                                disabled={spinning || pool.length === 0}
                                size="lg"
                                className="w-full sm:w-auto rounded-full font-bold shadow-lg shadow-primary/25"
                            >
                                {spinning ? t.roulette.spinning : t.roulette.spin}
                            </Button>
                        ) : (
                            <div className="flex gap-4 w-full sm:w-auto">
                                <Button
                                    variant="secondary"
                                    onClick={handleSpin}
                                    className="flex-1 rounded-full"
                                >
                                    {t.roulette.retry}
                                </Button>
                                <Button
                                    asChild
                                    className="flex-1 rounded-full font-bold"
                                >
                                    <Link href={`/vn/${winner.vn.id}`}>
                                        {t.roulette.details}
                                    </Link>
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
