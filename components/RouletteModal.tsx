"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
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

interface RouletteModalProps {
    isOpen: boolean;
    onClose: () => void;
    items: LibraryItem[];
}

export function RouletteModal({ isOpen, onClose, items }: RouletteModalProps) {
    const { t } = useLanguage();
    const [spinning, setSpinning] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [winner, setWinner] = useState<LibraryItem | null>(null);

    // Filter only "plan_to_play" items, or use all if none are planned
    const pool = items.filter(i => i.status === "plan_to_play").length > 0
        ? items.filter(i => i.status === "plan_to_play")
        : items;

    useEffect(() => {
        if (isOpen) {
            setWinner(null);
            setSpinning(false);
            setCurrentIndex(0);
        }
    }, [isOpen]);

    const handleSpin = () => {
        if (pool.length === 0) return;
        setSpinning(true);
        setWinner(null);

        const winningIndex = Math.floor(Math.random() * pool.length);
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

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-lg bg-[#0a0a0a] border-white/10">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-center gap-2 text-2xl font-bold">
                        <Dices className="w-6 h-6 text-accent" />
                        {t.roulette.title}
                    </DialogTitle>
                    <DialogDescription className="text-center text-gray-400">
                        {t.roulette.desc.replace("{count}", pool.length.toString())}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col items-center space-y-8 py-4">
                    <div className="relative w-48 h-64 sm:w-56 sm:h-80 rounded-xl overflow-hidden bg-secondary shadow-2xl border-2 border-white/10">
                        {currentItem?.vn.image ? (
                            <Image
                                src={currentItem.vn.image.url}
                                alt={currentItem.vn.title}
                                fill
                                className="object-cover"
                                sizes="(max-width: 640px) 192px, 224px"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-500">
                                {t.common.noImage}
                            </div>
                        )}

                        {/* Overlay for spinning effect */}
                        {spinning && (
                            <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px]" />
                        )}
                    </div>

                    <div className="space-y-2 text-center w-full">
                        <h3 className="text-xl font-bold px-4 line-clamp-2 min-h-[3.5rem] flex items-center justify-center">
                            {currentItem?.vn.title || "No Games Found"}
                        </h3>
                        {winner && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-accent font-bold flex items-center justify-center gap-2"
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
                                    className="flex-1 rounded-full font-bold shadow-lg shadow-accent/25"
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
