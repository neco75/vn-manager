"use client";

import { useLibrary } from "@/context/LibraryContext";
import { motion } from "framer-motion";
import { CalendarDays, Clock, Gamepad2, Hash, Loader2, PieChart, RefreshCw, Share2, Star, Trophy } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/context/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { calculateLibraryStatistics } from "@/lib/statistics";
import Link from "next/link";

export default function StatsPage() {
    const { items, isLoading, loadError, reloadLibrary, refreshNSFWFlags } = useLibrary();
    const shareRef = useRef<HTMLDivElement>(null);
    const { t } = useLanguage();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [refreshProgress, setRefreshProgress] = useState({ current: 0, total: 0 });

    const stats = useMemo(() => calculateLibraryStatistics(items), [items]);

    const handleShare = async () => {
        if (!shareRef.current || items.length === 0) return;
        try {
            await new Promise((resolve) => setTimeout(resolve, 500));

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
                        disabled={isRefreshing || items.length === 0 || isLoading || loadError}
                        className="gap-2 rounded-full text-gray-400 hover:text-white"
                    >
                        <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                        {t.stats.refreshNSFW}
                    </Button>
                    <Button
                        onClick={handleShare}
                        disabled={isLoading || loadError || items.length === 0}
                        className="gap-2 rounded-full font-bold shadow-lg shadow-primary/25"
                    >
                        <Share2 className="w-4 h-4" />
                        {t.stats.share}
                    </Button>
                </div>
            </div>

            <Dialog open={isRefreshing}>
                <DialogContent className="sm:max-w-md bg-card border-white/10 flex flex-col items-center py-10 gap-6">
                    <DialogHeader>
                        <DialogTitle className="text-center text-xl font-bold">
                            {t.common.loading}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="relative">
                        <div className="absolute inset-0 blur-xl bg-primary/20 animate-pulse rounded-full" />
                        <Loader2 className="w-16 h-16 text-primary animate-spin relative" />
                    </div>

                    <div className="space-y-2 text-center">
                        <p className="text-gray-400 text-sm">{t.stats.refreshDescription}</p>
                        <div className="text-2xl font-mono font-bold text-white">
                            {refreshProgress.current} <span className="text-gray-500 text-lg">/ {refreshProgress.total}</span>
                        </div>
                    </div>

                    <p className="text-xs text-gray-500 italic">{t.stats.refreshNote}</p>
                </DialogContent>
            </Dialog>

            {isLoading ? (
                <div className="rounded-2xl border border-border bg-card p-8 text-center text-gray-400" role="status">
                    {t.common.loading}
                </div>
            ) : loadError ? (
                <div className="rounded-2xl border border-destructive/40 bg-card p-8 text-center space-y-4" role="alert">
                    <h2 className="text-xl font-semibold">{t.home.loadErrorTitle}</h2>
                    <p className="text-sm text-gray-400">{t.home.loadErrorDesc}</p>
                    <Button onClick={() => void reloadLibrary()}>{t.home.retryLoad}</Button>
                </div>
            ) : (
                <div ref={shareRef} className="space-y-8 p-8 bg-[#0a0a0a] rounded-3xl border border-white/5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
                                {t.stats.shareTitle}
                            </h2>
                            <p className="mt-2 text-sm text-gray-400">
                                {t.stats.sharePeriod} · {t.stats.shareScope} · {t.stats.shareUnits}
                            </p>
                        </div>
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
                            value={stats.averageScore === null ? "—" : stats.averageScore.toFixed(1)}
                            detail={t.stats.ratedCount.replace("{count}", String(stats.ratedCount))}
                        />
                        <StatCard
                            icon={<Clock className="w-6 h-6 text-green-500" />}
                            label={t.stats.totalPlaytime}
                            value={formatHours(stats.actualPlaytimeMinutes, t.common.hours)}
                        />
                    </div>

                    <p className="-mt-4 text-sm text-gray-400">{t.stats.recordedPlaytimeNote}</p>

                    {items.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-card p-8 text-center text-gray-400 space-y-4">
                            <p>{t.stats.noRecords}</p>
                            <Button asChild>
                                <Link href="/search">{t.home.addButton}</Link>
                            </Button>
                        </div>
                    ) : (
                        <>
                            <Card className="border-white/10">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">{t.stats.estimatedPlaytime}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {stats.estimatedUnstartedCount === 0 ? (
                                        <p className="text-sm text-gray-400">{t.stats.noEstimatedPlaytimeTarget}</p>
                                    ) : (
                                        <>
                                            <div className="text-3xl font-bold">
                                                {formatHours(stats.estimatedUnstartedMinutes, t.common.hours)}
                                            </div>
                                            <p className="mt-1 text-xs text-gray-500">
                                                {t.stats.estimatedTargetCount.replace("{count}", String(stats.estimatedUnstartedCount))}
                                            </p>
                                        </>
                                    )}
                                    <p className="mt-2 text-sm text-gray-400">{t.stats.estimatedPlaytimeNote}</p>
                                </CardContent>
                            </Card>

                            <div className="grid md:grid-cols-2 gap-8">
                                <Card className="border-white/10">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <CalendarDays className="w-5 h-5 text-primary" />
                                            {t.stats.completedByMonth}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {stats.monthlyCompleted.length === 0 ? (
                                            <p className="text-sm text-gray-400">{t.stats.noCompletionHistory}</p>
                                        ) : (
                                            stats.monthlyCompleted.map((entry) => (
                                                <ProgressBar
                                                    key={entry.month}
                                                    label={entry.month}
                                                    value={entry.count}
                                                    total={Math.max(...stats.monthlyCompleted.map((month) => month.count))}
                                                    color="bg-primary"
                                                />
                                            ))
                                        )}
                                        {stats.completedWithoutDate > 0 && (
                                            <p className="text-sm text-gray-400">
                                                {t.stats.completedWithoutDate.replace("{count}", String(stats.completedWithoutDate))}
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>

                                <Card className="border-white/10">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <PieChart className="w-5 h-5 text-accent" />
                                            {t.stats.statusDist}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-5">
                                        <ProgressBar label={t.status.playing} value={stats.statusCounts.playing} total={stats.total} color="bg-primary" />
                                        <ProgressBar label={t.status.completed} value={stats.statusCounts.completed} total={stats.total} color="bg-yellow-500" />
                                        <ProgressBar label={t.status.watched} value={stats.statusCounts.watched} total={stats.total} color="bg-purple-500" />
                                        <ProgressBar label={t.status.on_hold} value={stats.statusCounts.on_hold} total={stats.total} color="bg-orange-500" />
                                        <ProgressBar label={t.status.dropped} value={stats.statusCounts.dropped} total={stats.total} color="bg-red-500" />
                                        <ProgressBar label={t.status.plan_to_play} value={stats.statusCounts.plan_to_play} total={stats.total} color="bg-blue-500" />
                                    </CardContent>
                                </Card>
                            </div>

                            <Card className="border-white/10">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Hash className="w-5 h-5 text-primary" />
                                        {t.stats.tagFrequency}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <p className="text-sm text-gray-400">{t.stats.tagFrequencyNote}</p>
                                    {stats.tagFrequencies.length === 0 ? (
                                        <p className="text-sm text-gray-400">{t.stats.noAggregationTarget}</p>
                                    ) : (
                                        stats.tagFrequencies.map((tag) => (
                                            <ProgressBar
                                                key={tag.name}
                                                label={tag.name}
                                                value={tag.count}
                                                total={stats.tagFrequencies[0].count}
                                                color="bg-accent"
                                            />
                                        ))
                                    )}
                                </CardContent>
                            </Card>
                        </>
                    )}
                </div>
            )}

        </div>
    );
}

function formatHours(minutes: number, unit: string): string {
    const hours = minutes / 60;
    const value = Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
    return `${value}${unit}`;
}

function StatCard({
    icon,
    label,
    value,
    detail,
}: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    detail?: string;
}) {
    return (
        <Card className="flex flex-col items-center justify-center p-6 text-center border-white/10">
            <div className="p-3 rounded-full bg-secondary/50 mb-2">{icon}</div>
            <div className="text-3xl font-bold">{value}</div>
            <div className="text-sm text-gray-400">{label}</div>
            {detail && <div className="mt-1 text-xs text-gray-500">{detail}</div>}
        </Card>
    );
}

function ProgressBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
    const percentage = total > 0 ? (value / total) * 100 : 0;
    return (
        <div className="space-y-2">
            <div className="flex justify-between gap-4 text-sm font-medium">
                <span className="truncate">{label}</span>
                <span className="shrink-0 text-gray-400">{value}</span>
            </div>
            <div className="h-3 bg-secondary rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, percentage)}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={`h-full ${color}`}
                />
            </div>
        </div>
    );
}
