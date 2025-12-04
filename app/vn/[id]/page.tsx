"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { getVNById } from "@/lib/vndb";
import { VN } from "@/types/vndb";
import { useLibrary } from "@/context/LibraryContext";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Star, Clock, Calendar, Tag, Image as ImageIcon, Trash2, Save, BookOpen, MessageSquare, ExternalLink, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import Link from "next/link";
import { toast } from "sonner";
import { Accordion } from "@/components/Accordion";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import dynamic from "next/dynamic";

const MarkdownEditor = dynamic(
    () => import("@/components/MarkdownEditor").then((mod) => mod.MarkdownEditor),
    { ssr: false }
);

import { GameStatus } from "@/types/library";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/context/LanguageContext";
import { PurchaseLocationSelector } from "@/components/PurchaseLocationSelector";

export default function VNPage() {
    const { id } = useParams();
    const [vn, setVn] = useState<VN | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { getItem, addItem, updateItem, removeItem } = useLibrary();
    const { setBackgroundImage } = useSettings();
    const { t } = useLanguage();

    // Local state for editing
    const [status, setStatus] = useState<GameStatus>("plan_to_play");
    const [score, setScore] = useState(0);
    const [notes, setNotes] = useState("");
    const [review, setReview] = useState("");
    const [playTime, setPlayTime] = useState(0);
    const [purchaseLocation, setPurchaseLocation] = useState("");
    const [isDirty, setIsDirty] = useState(false);
    const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

    const STATUSES: { value: GameStatus; label: string }[] = [
        { value: "playing", label: t.status.playing },
        { value: "completed", label: t.status.completed },
        { value: "watched", label: t.status.watched },
        { value: "on_hold", label: t.status.on_hold },
        { value: "dropped", label: t.status.dropped },
        { value: "plan_to_play", label: t.status.plan_to_play },
    ];

    useEffect(() => {
        async function fetchVN() {
            if (typeof id !== "string") return;
            try {
                const data = await getVNById(id);
                setVn(data);
            } catch (error) {
                console.error(error);
                toast.error(t.modal.fetchError);
            } finally {
                setIsLoading(false);
            }
        }
        fetchVN();
    }, [id, t]);

    const libraryItem = vn ? getItem(vn.id) : undefined;

    useEffect(() => {
        if (libraryItem) {
            setStatus(libraryItem.status);
            setScore(libraryItem.score);
            setNotes(libraryItem.notes);
            setReview(libraryItem.review || "");
            setPlayTime(libraryItem.playTime || 0);
            setPurchaseLocation(libraryItem.purchaseLocation || "");
        } else {
            // Reset to default if not in library
            setStatus("plan_to_play");
            setScore(0);
            setNotes("");
            setReview("");
            setPlayTime(0);
            setPurchaseLocation("");
        }
        setIsDirty(false); // Reset dirty state when libraryItem changes
    }, [libraryItem]);

    const handleSave = async () => {
        if (!vn) return;

        try {
            if (libraryItem) {
                await updateItem({ ...libraryItem, status, score, notes, review, playTime, purchaseLocation });
                toast.success(t.modal.saveSuccess);
            } else {
                await addItem(vn, status, score, notes, playTime, review, purchaseLocation);
                toast.success(t.modal.addToLibrarySuccess);
            }
            setIsDirty(false);
        } catch (error) {
            console.error(error);
            toast.error(t.modal.saveError);
        }
    };

    const handleDelete = async () => {
        if (!vn || !libraryItem) return;
        if (confirm(t.modal.confirmDelete)) {
            await removeItem(vn.id);
            toast.success(t.modal.deleteSuccess);
            // Reset local state defaults
            setStatus("plan_to_play");
            setScore(0);
            setNotes("");
            setReview("");
            setPlayTime(0);
            setIsDirty(false);
        }
    };

    if (isLoading) return <div className="flex justify-center py-20">{t.common.loading}</div>;
    if (!vn) return <div>{t.common.notFound}</div>;

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "VideoGame",
        "name": vn.title,
        "description": vn.description?.replace(/\[.*?\]/g, ""),
        "image": vn.image?.url,
        "datePublished": vn.released,
        "genre": vn.tags?.map(t => t.name),
        "author": {
            "@type": "Organization",
            "name": vn.developers?.[0]?.name
        },
        "aggregateRating": vn.rating ? {
            "@type": "AggregateRating",
            "ratingValue": (vn.rating / 10).toFixed(1),
            "bestRating": "10",
            "worstRating": "1",
            "ratingCount": vn.votecount
        } : undefined
    };

    return (
        <div className="max-w-5xl mx-auto pb-20 relative">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            {/* Page-specific Background */}
            {vn.image && (
                <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
                    <div
                        className="absolute inset-0 bg-cover bg-center blur-md opacity-40 scale-105"
                        style={{ backgroundImage: `url(${vn.image.url})` }}
                    />
                    <div className="absolute inset-0 bg-black/60" />
                </div>
            )}

            <Link
                href="/"
                className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6 group"
            >    <ArrowLeft className="w-4 h-4" />
                {t.common.back}
            </Link>

            <div className="grid lg:grid-cols-[350px_1fr] gap-8">
                {/* Left Column: Image & Controls */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                >
                    <div className="rounded-xl overflow-hidden border border-white/10 shadow-2xl">
                        {vn.image ? (
                            <div className="space-y-4">
                                <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden shadow-2xl border border-white/10">
                                    <Image
                                        src={vn.image.url}
                                        alt={vn.title}
                                        fill
                                        className="object-cover"
                                        sizes="(max-width: 1024px) 100vw, 350px"
                                        priority
                                    />
                                </div>



                                <Button
                                    variant="secondary"
                                    className="w-full gap-2"
                                    onClick={() => {
                                        setBackgroundImage(vn.image?.url || null);
                                        toast.success(t.modal.bgSetSuccess);
                                    }}
                                >
                                    <ImageIcon className="w-4 h-4" />
                                    {t.common.setBackground}
                                </Button>
                            </div>
                        ) : (
                            <div className="w-full aspect-[2/3] bg-secondary flex items-center justify-center">{t.common.noImage}</div>
                        )}
                    </div>

                    <div className="bg-card border border-white/10 rounded-xl p-6 space-y-6">
                        <div className="space-y-2">
                            <Label>{t.common.status}</Label>
                            <Select value={status} onValueChange={(v) => { setStatus(v as GameStatus); setIsDirty(true); }}>
                                <SelectTrigger className="bg-secondary/50 border-white/10">
                                    <SelectValue placeholder={t.common.selectStatus} />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUSES.map((s) => (
                                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <Label>{t.common.score}</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={score}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            if (!isNaN(val) && val >= 0 && val <= 100) {
                                                setScore(val);
                                                setIsDirty(true);
                                            }
                                        }}
                                        className="w-16 h-8 text-right font-bold text-white bg-secondary/50 border-white/10"
                                    />
                                    <span className="text-sm text-gray-500">/ 100</span>
                                </div>
                            </div>
                            <Slider
                                min={0}
                                max={100}
                                step={1}
                                value={[score]}
                                onValueChange={(vals) => { setScore(vals[0]); setIsDirty(true); }}
                                className="cursor-pointer"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>{t.common.playTime} ({t.common.hours})</Label>
                            <Input
                                type="number"
                                min="0"
                                step="0.5"
                                value={playTime ? playTime / 60 : ""}
                                onChange={(e) => { setPlayTime(parseFloat(e.target.value) * 60); setIsDirty(true); }}
                                className="bg-secondary/50 border-white/10"
                                placeholder="0.0"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Purchase Location</Label>
                            <PurchaseLocationSelector
                                value={purchaseLocation}
                                onChange={(v) => { setPurchaseLocation(v); setIsDirty(true); }}
                            />
                        </div>

                        <div className="pt-2 flex gap-3">
                            {libraryItem && (
                                <Button
                                    variant="destructive"
                                    size="icon"
                                    onClick={handleDelete}
                                    title={t.common.delete}
                                >
                                    <Trash2 className="w-5 h-5" />
                                </Button>
                            )}
                            <Button
                                className="flex-1 gap-2 font-bold shadow-lg shadow-primary/25"
                                onClick={handleSave}
                                disabled={!isDirty}
                            >
                                <Save className="w-5 h-5" />
                                {libraryItem ? t.common.save : t.common.addToLibrary}
                            </Button>
                        </div>
                    </div>
                </motion.div>

                {/* Right Column: Details & Inputs */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="space-y-8"
                >
                    <div>
                        <h1 className="text-4xl md:text-5xl font-bold leading-tight">{vn.title}</h1>
                        <div className="flex flex-wrap gap-4 mt-4 text-sm">
                            <Badge variant="secondary" className="gap-2 px-3 py-1.5 text-sm font-normal">
                                <Star className="w-4 h-4 text-yellow-500" />
                                <span className="font-bold">{vn.rating ? (vn.rating / 10).toFixed(1) : "N/A"}</span>
                                <span className="text-gray-500">/ 10 (VNDB)</span>
                            </Badge>
                            <Badge variant="secondary" className="gap-2 px-3 py-1.5 text-sm font-normal">
                                <Calendar className="w-4 h-4 text-blue-400" />
                                <span>{vn.released || t.common.tba}</span>
                            </Badge>
                            {vn.length_minutes && (
                                <Badge variant="secondary" className="gap-2 px-3 py-1.5 text-sm font-normal">
                                    <Clock className="w-4 h-4 text-green-400" />
                                    <span>{Math.round(vn.length_minutes / 60)} {t.common.hoursEstimated}</span>
                                </Badge>
                            )}
                            <a
                                href={`https://vndb.org/${vn.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
                            >
                                <ExternalLink className="w-4 h-4" />
                                {t.common.viewOnVNDB}
                            </a>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <Accordion
                            title={<div className="flex items-center gap-2"><BookOpen className="w-5 h-5 text-primary" /> {t.common.synopsis}</div>}
                            defaultOpen={true}
                        >
                            <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                                {vn.description?.replace(/\[.*?\]/g, "") || t.common.noSynopsis}
                            </p>
                        </Accordion>

                        <Accordion
                            title={<div className="flex items-center gap-2"><Tag className="w-5 h-5 text-accent" /> {t.common.tags} & {t.common.developer}</div>}
                        >
                            <div className="space-y-4">
                                <div>
                                    <h4 className="text-sm font-medium text-gray-400 mb-2">{t.common.developer}</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {vn.developers?.map((dev) => (
                                            <Badge key={dev.id} variant="outline" className="border-white/10">
                                                {dev.name}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-sm font-medium text-gray-400 mb-2">{t.common.tags}</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {vn.tags?.map((tag) => (
                                            <Badge key={tag.id} variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                                                {tag.name}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </Accordion>

                        <Accordion
                            title={<div className="flex items-center gap-2"><ImageIcon className="w-5 h-5 text-purple-400" /> {t.common.gallery} & {t.common.links}</div>}
                        >
                            <div className="space-y-6">
                                {/* External Links */}
                                {vn.extlinks && vn.extlinks.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-400 mb-3">{t.common.relatedLinks}</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {vn.extlinks.map((link, i) => (
                                                <a
                                                    key={`${link.id}-${i}`}
                                                    href={link.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50 hover:bg-secondary text-sm transition-colors border border-white/5 hover:border-white/20"
                                                >
                                                    <ExternalLink className="w-3 h-3" />
                                                    {link.label || t.common.link}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Screenshots */}
                                {vn.screenshots && vn.screenshots.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-400 mb-3">{t.common.screenshots}</h4>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {vn.screenshots.map((ss, i) => (
                                                <div
                                                    key={i}
                                                    className="relative aspect-video rounded-lg overflow-hidden group bg-black/20 cursor-pointer"
                                                    onClick={() => setSelectedImageIndex(i)}
                                                >
                                                    <Image
                                                        src={ss.thumbnail}
                                                        alt={`Screenshot ${i + 1}`}
                                                        fill
                                                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                                                        sizes="(max-width: 640px) 50vw, 33vw"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Accordion>



                        <Accordion
                            title={<div className="flex items-center gap-2"><BookOpen className="w-5 h-5 text-gray-400" /> メモ (非公開)</div>}
                        >
                            <ErrorBoundary>
                                <MarkdownEditor
                                    value={notes}
                                    onChange={(val) => { setNotes(val); setIsDirty(true); }}
                                    height="h-80"
                                    placeholder="攻略メモや進捗などを記録... (Markdown対応)"
                                />
                            </ErrorBoundary>
                        </Accordion>

                        <Accordion
                            title={<div className="flex items-center gap-2"><MessageSquare className="w-5 h-5 text-accent" /> 感想・レビュー</div>}
                        >
                            <ErrorBoundary>
                                <MarkdownEditor
                                    value={review}
                                    onChange={(val) => { setReview(val); setIsDirty(true); }}
                                    height="h-80"
                                    placeholder="クリア後の感想やレビューを記録... (Markdown対応)"
                                />
                            </ErrorBoundary>
                        </Accordion>
                    </div>
                </motion.div>
            </div>

            <AnimatePresence>
                {selectedImageIndex !== null && vn?.screenshots && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedImageIndex(null)}
                        className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                    >
                        <button
                            onClick={() => setSelectedImageIndex(null)}
                            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-50"
                        >
                            <X className="w-6 h-6" />
                        </button>

                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedImageIndex((prev) => (prev !== null ? (prev - 1 + vn.screenshots.length) % vn.screenshots.length : null));
                            }}
                            className="absolute left-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-50"
                        >
                            <ChevronLeft className="w-8 h-8" />
                        </button>

                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedImageIndex((prev) => (prev !== null ? (prev + 1) % vn.screenshots.length : null));
                            }}
                            className="absolute right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-50"
                        >
                            <ChevronRight className="w-8 h-8" />
                        </button>

                        <motion.div
                            key={selectedImageIndex}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.2 }}
                            className="relative w-full h-full max-w-7xl max-h-[90vh]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Image
                                src={vn.screenshots[selectedImageIndex].url}
                                alt="Full size"
                                fill
                                className="object-contain"
                                sizes="100vw"
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
