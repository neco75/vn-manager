"use client";

import { useLibrary } from "@/context/LibraryContext";
import { motion } from "framer-motion";
import { PieChart, Save, Upload, Download, Gamepad2, Trophy, Clock, Star, Share2, Hash, RefreshCw, Loader2 } from "lucide-react";
import { useState, useRef, useMemo } from "react";
import { toast } from "sonner";
import * as db from "@/lib/db";
import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    ResponsiveContainer,
    Tooltip,
} from "recharts";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/context/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function StatsPage() {
    const { items, isLoading, refreshNSFWFlags } = useLibrary();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const shareRef = useRef<HTMLDivElement>(null);
    const { t } = useLanguage();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [refreshProgress, setRefreshProgress] = useState({ current: 0, total: 0 });

    const stats = useMemo(() => {
        return {
            total: items.length,
            completed: items.filter((i) => i.status === "completed").length,
            watched: items.filter((i) => i.status === "watched").length,
            playing: items.filter((i) => i.status === "playing").length,
            avgScore:
                items.filter((i) => i.score > 0).reduce((acc, i) => acc + i.score, 0) /
                items.filter((i) => i.score > 0).length || 0,
            totalPlaytime: items.reduce((acc, i) => {
                // Exclude watched games from total playtime
                if (i.status === "watched") return acc;

                const actual = i.playTime || 0;
                const estimated = i.vn.length_minutes || 0;

                // If actual playtime exists, use it regardless of status
                if (actual > 0) return acc + actual;

                // If no actual playtime, use estimated ONLY if it's not "plan_to_play"
                if (i.status !== "plan_to_play") return acc + estimated;

                return acc;
            }, 0) / 60,
        };
    }, [items]);

    const tagData = useMemo(() => {
        const tagCounts: Record<string, number> = {};
        items.forEach(item => {
            item.vn.tags.forEach(tag => {
                tagCounts[tag.name] = (tagCounts[tag.name] || 0) + 1;
            });
        });

        return Object.entries(tagCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 6); // Top 6 tags for Radar Chart
    }, [items]);

    const exportData = async () => {
        const data = await db.getAllLibraryItems();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `vn-manager-backup-${new Date().toISOString().split("T")[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(t.stats.toasts.exportSuccess);
    };

    const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                if (!Array.isArray(data)) throw new Error("Invalid format");

                for (const item of data) {
                    await db.addToLibrary(item);
                }
                window.location.reload();
                toast.success(t.stats.toasts.importSuccess);
            } catch (error) {
                console.error(error);
                toast.error(t.stats.toasts.importError);
            }
        };
        reader.readAsText(file);
    };

    const handleShare = async () => {
        if (!shareRef.current) return;
        try {
            // Wait a bit for animations/styles
            await new Promise(resolve => setTimeout(resolve, 500));

            const dataUrl = await toPng(shareRef.current, {
                backgroundColor: "#0a0a0a",
                pixelRatio: 2,
                cacheBust: true,
            });

            const link = document.createElement("a");
            link.href = dataUrl;
            link.download = "my-vn-stats.png";
            link.click();
            toast.success(t.stats.toasts.shareSuccess);
        } catch (error) {
            console.error("Share Error:", error);
            toast.error(t.stats.toasts.shareError);
        }
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        setRefreshProgress({ current: 0, total: items.length });
        try {
            const count = await refreshNSFWFlags((current, total) => {
                setRefreshProgress({ current, total });
            });
            toast.success(t.stats.toasts.refreshSuccess.replace("{count}", String(count)));
        } catch (error) {
            console.error(error);
            toast.error(t.stats.toasts.refreshError);
        } finally {
            setIsRefreshing(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-12 pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold">{t.stats.title}</h1>
                    <p className="text-gray-400">{t.stats.subtitle}</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="ghost"
                        onClick={handleRefresh}
                        disabled={isRefreshing || items.length === 0}
                        className="gap-2 rounded-full text-gray-400 hover:text-white"
                    >
                        <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                        {t.stats.refreshNSFW}
                    </Button>
                    <Button
                        onClick={handleShare}
                        className="gap-2 rounded-full font-bold shadow-lg shadow-primary/25"
                    >
                        <Share2 className="w-4 h-4" />
                        {t.stats.share}
                    </Button>
                </div>
            </div>

            {/* Progress Dialog */}
            <Dialog open={isRefreshing}>
                <DialogContent className="sm:max-w-md bg-card border-white/10 flex flex-col items-center py-10 gap-6">
                    <DialogHeader>
                        <DialogTitle className="text-center text-xl font-bold">
                            {t.common.loading || "Now Loading..."}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="relative">
                        <div className="absolute inset-0 blur-xl bg-primary/20 animate-pulse rounded-full" />
                        <Loader2 className="w-16 h-16 text-primary animate-spin relative" />
                    </div>

                    <div className="space-y-2 text-center">
                        <p className="text-gray-400 text-sm">
                            VNDBから情報を取得しています...
                        </p>
                        <div className="text-2xl font-mono font-bold text-white">
                            {refreshProgress.current} <span className="text-gray-500 text-lg">/ {refreshProgress.total}</span>
                        </div>
                    </div>

                    <p className="text-xs text-gray-500 italic">
                        サーバーの負担を抑えるため、ゆっくり更新しています。
                    </p>
                </DialogContent>
            </Dialog>

            {/* Shareable Area */}
            <div ref={shareRef} className="space-y-8 p-8 bg-[#0a0a0a] rounded-3xl border border-white/5">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
                        {t.stats.shareTitle}
                    </h2>
                    <div className="text-sm text-gray-500">VN Manager</div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        icon={<Gamepad2 className="w-6 h-6 text-primary" />}
                        label={t.stats.totalGames}
                        value={stats.total}
                    />
                    <StatCard
                        icon={<Trophy className="w-6 h-6 text-yellow-500" />}
                        label={t.stats.completed}
                        value={stats.completed}
                    />
                    <StatCard
                        icon={<Star className="w-6 h-6 text-accent" />}
                        label={t.stats.avgScore}
                        value={stats.avgScore.toFixed(1)}
                    />
                    <StatCard
                        icon={<Clock className="w-6 h-6 text-green-500" />}
                        label={t.stats.totalPlaytime}
                        value={`${Math.round(stats.totalPlaytime)}${t.common.hours}`}
                    />
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                    <Card className="h-[400px] flex flex-col border-white/10">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Hash className="w-5 h-5 text-primary" />
                                {t.stats.topTags}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 w-full min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={tagData}>
                                    <PolarGrid stroke="#333" />
                                    <PolarAngleAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                                    <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                                    <Radar
                                        name="Tags"
                                        dataKey="count"
                                        stroke="#8b5cf6"
                                        fill="#8b5cf6"
                                        fillOpacity={0.5}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                </RadarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    <Card className="h-[400px] flex flex-col border-white/10">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <PieChart className="w-5 h-5 text-accent" />
                                {t.stats.statusDist}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 flex-1 flex flex-col justify-center">
                            <ProgressBar label={t.status.playing} value={stats.playing} total={stats.total} color="bg-primary" />
                            <ProgressBar label={t.status.completed} value={stats.completed} total={stats.total} color="bg-yellow-500" />
                            <ProgressBar label={t.status.watched} value={stats.watched} total={stats.total} color="bg-purple-500" />
                            <ProgressBar label={t.status.plan_to_play} value={items.filter(i => i.status === "plan_to_play").length} total={stats.total} color="bg-blue-500" />
                            <ProgressBar label={t.stats.others} value={stats.total - stats.playing - stats.completed - stats.watched - items.filter(i => i.status === "plan_to_play").length} total={stats.total} color="bg-gray-600" />
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Data Management Section (Not for share) */}
            <Card className="border-white/10">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Save className="w-5 h-5 text-primary" />
                        {t.stats.dataManagement}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <Button
                            variant="outline"
                            onClick={exportData}
                            className="w-full gap-2 h-12"
                        >
                            <Download className="w-4 h-4" />
                            {t.stats.export}
                        </Button>

                        <div className="relative">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={importData}
                                accept=".json"
                                className="hidden"
                            />
                            <Button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full gap-2 h-12 shadow-lg shadow-primary/25"
                            >
                                <Upload className="w-4 h-4" />
                                {t.stats.import}
                            </Button>
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 text-center">
                        {t.stats.importWarning}
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
    return (
        <Card className="flex flex-col items-center justify-center p-6 text-center border-white/10">
            <div className="p-3 rounded-full bg-secondary/50 mb-2">{icon}</div>
            <div className="text-3xl font-bold">{value}</div>
            <div className="text-sm text-gray-400">{label}</div>
        </Card>
    );
}

function ProgressBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
    const percentage = total > 0 ? (value / total) * 100 : 0;
    return (
        <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium">
                <span>{label}</span>
                <span className="text-gray-400">{value}本 ({percentage.toFixed(0)}%)</span>
            </div>
            <div className="h-3 bg-secondary rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={`h-full ${color}`}
                />
            </div>
        </div>
    );
}
