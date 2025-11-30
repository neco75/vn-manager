"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Search } from "lucide-react";

export function HeroSection() {
    return (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900/50 via-purple-900/50 to-pink-900/50 border border-white/10 p-8 sm:p-12 mb-12">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
            <div className="relative z-10 max-w-2xl space-y-6">
                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="text-4xl sm:text-5xl font-bold tracking-tight text-white"
                >
                    あなたの<span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">物語</span>を<br />管理しよう
                </motion.h1>
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="text-lg text-gray-300"
                >
                    プレイしたノベルゲームの感動を記録し、<br />
                    次の冒険を見つけるためのパーソナルライブラリ。
                </motion.p>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                >
                    <Link
                        href="/search"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black font-bold hover:bg-gray-200 transition-colors shadow-lg shadow-white/10"
                    >
                        <Search className="w-5 h-5" />
                        新しいゲームを探す
                    </Link>
                </motion.div>
            </div>
        </div>
    );
}
