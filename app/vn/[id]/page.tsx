"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useParams, useSearchParams } from "next/navigation";
import { getVNById } from "@/lib/vndb";
import { mergeLibraryItemMetadata, type LibraryItemEdits } from "@/lib/library-state";
import { VN } from "@/types/vndb";
import { useLibrary } from "@/context/LibraryContext";
import { motion } from "framer-motion";
import { ArrowLeft, Star, Clock, Calendar, Tag, Image as ImageIcon, Trash2, Save, BookOpen, MessageSquare, ExternalLink, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { shouldBlurImage } from "@/lib/image-safety";
import { getVisibleSynopsisText, getVisibleTags } from "@/lib/spoiler-safety";
import { SpoilerSynopsis, SpoilerTagList } from "@/components/Spoiler";
import Link from "next/link";
import { toast } from "sonner";
import { Accordion } from "@/components/Accordion";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import dynamic from "next/dynamic";

const MarkdownEditor = dynamic(
    () => import("@/components/MarkdownEditor").then((mod) => mod.MarkdownEditor),
    { ssr: false }
);

import { GameStatus, OwnershipStatus, getLibraryValidationError } from "@/types/library";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
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
import { getDisplayTitle } from "@/lib/vndb-title";

type ExternalFetchState = "idle" | "loading" | "success" | "not-found" | "error";

export default function VNPage() {
    const { id } = useParams();
    const searchParams = useSearchParams();
    const routeId = typeof id === "string" ? id : null;
    const returnToParam = searchParams.get("from");
    const returnTo = returnToParam && (returnToParam === "/" || returnToParam.startsWith("/?"))
        ? returnToParam
        : "/";
    const [vn, setVn] = useState<VN | null>(null);
    const [externalState, setExternalState] = useState<ExternalFetchState>("idle");
    const [retryVersion, setRetryVersion] = useState(0);
    const {
        getItem,
        addItem,
        updateItem,
        removeItem,
        isLoading: isLibraryLoading,
        loadError,
        reloadLibrary,
    } = useLibrary();
    const { setBackgroundImage, nsfwBlur } = useSettings();
    const { language, t } = useLanguage();

    // Local state for editing
    const [status, setStatus] = useState<GameStatus>("plan_to_play");
    const [ownership, setOwnership] = useState<OwnershipStatus>("unknown");
    const [score, setScore] = useState<number | null>(null);
    const [notes, setNotes] = useState("");
    const [review, setReview] = useState("");
    const [playTime, setPlayTime] = useState(0);
    const [purchaseLocation, setPurchaseLocation] = useState("");
    const [startedOn, setStartedOn] = useState("");
    const [completedOn, setCompletedOn] = useState("");
    const [lastPlayedOn, setLastPlayedOn] = useState("");
    const [resumeNote, setResumeNote] = useState("");
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
    const screenshotButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const openedScreenshotIndexRef = useRef<number | null>(null);
    const initializedRouteRef = useRef<string | null>(null);
    const requestSequenceRef = useRef(0);

    const STATUSES: { value: GameStatus; label: string }[] = [
        { value: "playing", label: t.status.playing },
        { value: "completed", label: t.status.completed },
        { value: "watched", label: t.status.watched },
        { value: "on_hold", label: t.status.on_hold },
        { value: "dropped", label: t.status.dropped },
        { value: "plan_to_play", label: t.status.plan_to_play },
    ];

    const libraryItem = routeId ? getItem(routeId) : undefined;

    useEffect(() => {
        initializedRouteRef.current = null;
        requestSequenceRef.current += 1;
        setVn(null);
        setExternalState("idle");
        setRetryVersion(0);
        setSelectedImageIndex(null);
    }, [routeId]);

    useEffect(() => {
        if (!routeId || isLibraryLoading || initializedRouteRef.current === routeId) return;

        initializedRouteRef.current = routeId;
        if (libraryItem) {
            setVn(libraryItem.vn);
            setStatus(libraryItem.status);
            setOwnership(libraryItem.ownership);
            setScore(libraryItem.score);
            setNotes(libraryItem.notes);
            setReview(libraryItem.review || "");
            setPlayTime(libraryItem.playTime || 0);
            setPurchaseLocation(libraryItem.purchaseLocation || "");
            setStartedOn(libraryItem.startedOn || "");
            setCompletedOn(libraryItem.completedOn || "");
            setLastPlayedOn(libraryItem.lastPlayedOn || "");
            setResumeNote(libraryItem.resumeNote || "");
        } else {
            setStatus("plan_to_play");
            setOwnership("unknown");
            setScore(null);
            setNotes("");
            setReview("");
            setPlayTime(0);
            setPurchaseLocation("");
            setStartedOn("");
            setCompletedOn("");
            setLastPlayedOn("");
            setResumeNote("");
        }
        setIsDirty(false);
    }, [routeId, isLibraryLoading, libraryItem]);

    useEffect(() => {
        if (!routeId || isLibraryLoading || loadError) return;

        const controller = new AbortController();
        const requestSequence = ++requestSequenceRef.current;
        setExternalState("loading");

        void getVNById(routeId, { signal: controller.signal })
            .then((data) => {
                if (controller.signal.aborted || requestSequenceRef.current !== requestSequence) return;

                if (!data) {
                    setExternalState("not-found");
                    return;
                }

                setVn(data);
                setExternalState("success");
            })
            .catch((error) => {
                if (controller.signal.aborted || requestSequenceRef.current !== requestSequence) return;
                console.error("Failed to fetch VN details:", error);
                setExternalState("error");
            });

        return () => controller.abort();
    }, [routeId, isLibraryLoading, loadError, retryVersion]);

    const handleSave = async () => {
        if (!vn || isSaving) return;

        const edits: LibraryItemEdits = {
            status,
            ownership,
            score,
            notes,
            review,
            playTime,
            purchaseLocation: purchaseLocation || undefined,
            startedOn: startedOn || undefined,
            completedOn: completedOn || undefined,
            lastPlayedOn: lastPlayedOn || undefined,
            resumeNote: resumeNote || undefined,
        };
        const invalidField = getLibraryValidationError(edits);
        const validationMessage =
            invalidField === "status" ? t.modal.invalidStatus :
            invalidField === "ownership" ? t.modal.invalidOwnership :
            invalidField === "score" ? t.modal.invalidScore :
            invalidField === "playTime" ? t.modal.invalidPlayTime :
            invalidField === "dateOrder" ? t.modal.invalidDateOrder :
            invalidField === "resumeNote" ? t.modal.invalidResumeNote :
            invalidField ? t.modal.invalidDate : null;
        if (validationMessage) {
            toast.error(validationMessage);
            return;
        }

        setIsSaving(true);
        try {
            if (libraryItem) {
                const itemWithLatestMetadata = mergeLibraryItemMetadata(libraryItem, vn);
                await updateItem({ ...itemWithLatestMetadata, ...edits });
                toast.success(t.modal.saveSuccess);
            } else {
                await addItem(vn, edits);
                toast.success(t.modal.addToLibrarySuccess);
            }
            setIsDirty(false);
        } catch (error) {
            console.error(error);
            toast.error(t.modal.saveError);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!vn || !libraryItem || isDeleting) return;
        if (confirm(t.modal.confirmDelete)) {
            setIsDeleting(true);
            try {
                await removeItem(vn.id);
                toast.success(t.modal.deleteSuccess);
                setStatus("plan_to_play");
                setOwnership("unknown");
                setScore(null);
                setNotes("");
                setReview("");
                setPlayTime(0);
                setPurchaseLocation("");
                setStartedOn("");
                setCompletedOn("");
                setLastPlayedOn("");
                setResumeNote("");
                setIsDirty(false);
            } catch (error) {
                console.error(error);
                toast.error(t.modal.deleteError);
            } finally {
                setIsDeleting(false);
            }
        }
    };

    if (isLibraryLoading) {
        return <div className="flex justify-center py-20">{t.common.loading}</div>;
    }

    if (loadError) {
        return (
            <div className="mx-auto max-w-xl space-y-4 py-20 text-center">
                <h1 className="text-xl font-semibold">{t.home.loadErrorTitle}</h1>
                <p className="text-sm text-gray-400">{t.home.loadErrorDesc}</p>
                <Button onClick={() => void reloadLibrary()}>{t.home.retryLoad}</Button>
            </div>
        );
    }

    if (!vn && (externalState === "idle" || externalState === "loading")) {
        return <div className="flex justify-center py-20">{t.common.loading}</div>;
    }

    if (!vn && externalState === "not-found") {
        return (
            <div className="mx-auto max-w-xl space-y-4 py-20 text-center">
                <h1 className="text-xl font-semibold">{t.vn.notFoundTitle}</h1>
                <p className="text-sm text-gray-400">{t.vn.notFoundDesc}</p>
                <Button variant="outline" onClick={() => setRetryVersion((value) => value + 1)}>
                    {t.vn.retryExternal}
                </Button>
            </div>
        );
    }

    if (!vn && externalState === "error") {
        return (
            <div className="mx-auto max-w-xl space-y-4 py-20 text-center">
                <h1 className="text-xl font-semibold">{t.vn.externalErrorTitle}</h1>
                <p className="text-sm text-gray-400">{t.vn.externalErrorDesc}</p>
                <Button variant="outline" onClick={() => setRetryVersion((value) => value + 1)}>
                    {t.vn.retryExternal}
                </Button>
            </div>
        );
    }

    if (!vn) return <div>{t.common.notFound}</div>;

    const displayTitle = getDisplayTitle(vn, language);
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "VideoGame",
        "name": displayTitle,
        "description": getVisibleSynopsisText(vn.description),
        "image": vn.image?.url,
        "datePublished": vn.released,
        "genre": getVisibleTags(vn.tags).map((tag) => tag.name),
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
                <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none bg-background">
                    <div
                        className={cn(
                            "absolute inset-0 bg-cover bg-center opacity-40 scale-105 transition-all duration-1000",
                            shouldBlurImage(vn.image?.sexual, nsfwBlur) ? "blur-3xl" : "blur-md"
                        )}
                        style={{ backgroundImage: `url(${vn.image.url})` }}
                    />
                    <div className="absolute inset-0 bg-black/60" />
                </div>
            )}

            <Link
                href={returnTo}
                className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6 group"
            >    <ArrowLeft className="w-4 h-4" />
                {t.common.back}
            </Link>

            {libraryItem && externalState !== "success" && (
                <div className="mb-6 rounded-lg border border-white/10 bg-card/80 p-4 text-sm">
                    {externalState === "loading" ? (
                        <p className="text-gray-400">{t.vn.externalLoadingSaved}</p>
                    ) : (
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="font-medium">
                                    {externalState === "not-found"
                                        ? t.vn.externalNotFoundSaved
                                        : t.vn.externalErrorSaved}
                                </p>
                                <p className="mt-1 text-gray-400">{t.vn.localRecordAvailable}</p>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setRetryVersion((value) => value + 1)}
                            >
                                {t.vn.retryExternal}
                            </Button>
                        </div>
                    )}
                </div>
            )}


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
                                        alt={displayTitle}
                                        fill
                                        className={cn(
                                            "object-cover transition-all duration-500",
                                            shouldBlurImage(vn.image?.sexual, nsfwBlur) && "blur-2xl scale-110"
                                        )}
                                        sizes="(max-width: 1024px) 100vw, 350px"
                                        priority
                                    />
                                    {shouldBlurImage(vn.image?.sexual, nsfwBlur) && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                                            <Badge variant="destructive" className="bg-red-600 text-white border-none shadow-xl px-4 py-2 text-lg">{t.settings.imageBlurred}</Badge>
                                        </div>
                                    )}
                                </div>



                                <Button
                                    variant="secondary"
                                    className="w-full gap-2"
                                    onClick={() => {
                                        setBackgroundImage(vn.image?.url || null, vn.image?.sexual ?? null);
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
                            <Label htmlFor="detail-status">{t.common.status}</Label>
                            <Select value={status} onValueChange={(v) => { setStatus(v as GameStatus); setIsDirty(true); }}>
                                <SelectTrigger id="detail-status" className="min-h-11 w-full bg-secondary/50 border-white/10">
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
                                <Label htmlFor="detail-score">{t.common.score}</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        id="detail-score"
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={score ?? ""}
                                        placeholder={t.common.unrated}
                                        onChange={(e) => {
                                            const raw = e.target.value;
                                            setScore(raw === "" ? null : Number(raw));
                                            setIsDirty(true);
                                        }}
                                        className="h-11 w-24 text-right font-bold text-white bg-secondary/50 border-white/10"
                                    />
                                    <span className="text-sm text-gray-500">/ 100</span>
                                </div>
                            </div>
                            <Slider
                                min={0}
                                max={100}
                                step={1}
                                value={[score ?? 0]}
                                onValueChange={(vals) => { setScore(vals[0]); setIsDirty(true); }}
                                aria-label={t.common.score}
                                className="cursor-pointer"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={score === null}
                                onClick={() => { setScore(null); setIsDirty(true); }}
                            >
                                {t.common.markUnrated}
                            </Button>
                            <p className="text-xs text-gray-500">{t.common.legacyZeroScoreNote}</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="detail-play-time">{t.common.playTime} ({t.common.hours})</Label>
                            <Input
                                id="detail-play-time"
                                type="number"
                                min="0"
                                step="0.5"
                                value={playTime ? playTime / 60 : ""}
                                onChange={(e) => {
                                    const rawValue = e.target.value.trim();
                                    setPlayTime(rawValue === "" ? 0 : Number(rawValue) * 60);
                                    setIsDirty(true);
                                }}
                                className="min-h-11 bg-secondary/50 border-white/10"
                                placeholder="0.0"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="detail-purchase-location">{t.common.purchaseLocation}</Label>
                            <PurchaseLocationSelector
                                id="detail-purchase-location"
                                value={purchaseLocation}
                                onChange={(v) => { setPurchaseLocation(v); setIsDirty(true); }}
                            />
                        </div>

                        <details className="rounded-lg border border-white/10 p-4">
                            <summary className="cursor-pointer font-medium">{t.common.recordDetails}</summary>
                            <div className="mt-4 space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="detail-ownership">{t.common.ownership}</Label>
                                    <Select
                                        value={ownership}
                                        onValueChange={(value) => {
                                            setOwnership(value as OwnershipStatus);
                                            setIsDirty(true);
                                        }}
                                    >
                                        <SelectTrigger id="detail-ownership" className="min-h-11 w-full bg-secondary/50 border-white/10">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="unknown">{t.ownership.unknown}</SelectItem>
                                            <SelectItem value="owned">{t.ownership.owned}</SelectItem>
                                            <SelectItem value="wishlist">{t.ownership.wishlist}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <RecordDateInput id="detail-started-on" label={t.common.startedOn} value={startedOn} onChange={(value) => { setStartedOn(value); setIsDirty(true); }} />
                                <RecordDateInput id="detail-completed-on" label={t.common.completedOn} value={completedOn} onChange={(value) => { setCompletedOn(value); setIsDirty(true); }} todayLabel={t.common.today} />
                                <RecordDateInput id="detail-last-played-on" label={t.common.lastPlayedOn} value={lastPlayedOn} onChange={(value) => { setLastPlayedOn(value); setIsDirty(true); }} />

                                <div className="space-y-2">
                                    <Label htmlFor="detail-resume-note">{t.common.resumeNote}</Label>
                                    <Input
                                        id="detail-resume-note"
                                        value={resumeNote}
                                        maxLength={200}
                                        onChange={(e) => { setResumeNote(e.target.value); setIsDirty(true); }}
                                        placeholder={t.common.resumeNotePlaceholder}
                                    />
                                </div>
                            </div>
                        </details>

                        <div className="pt-2 flex gap-3">
                            {libraryItem && (
                                <Button
                                    variant="destructive"
                                    size="icon"
                                    onClick={handleDelete}
                                    disabled={isDeleting || isSaving}
                                    aria-label={t.common.delete}
                                    title={t.common.delete}
                                    className="h-11 w-11"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </Button>
                            )}
                            <Button
                                className="flex-1 gap-2 font-bold shadow-lg shadow-primary/25"
                                onClick={handleSave}
                                disabled={isSaving || isDeleting || (!!libraryItem && !isDirty)}
                            >
                                <Save className="w-5 h-5" />
                                {isSaving ? t.modal.saving : (libraryItem ? t.common.save : t.common.addToLibrary)}
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
                        <h1 className="text-4xl md:text-5xl font-bold leading-tight">{displayTitle}</h1>
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
                            <SpoilerSynopsis key={vn.id} description={vn.description} />
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
                                    <SpoilerTagList key={vn.id} tags={vn.tags} />
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
                                                <button
                                                    key={i}
                                                    ref={(node) => {
                                                        screenshotButtonRefs.current[i] = node;
                                                    }}
                                                    type="button"
                                                    aria-label={`${t.common.screenshots} ${i + 1}`}
                                                    className="group relative aspect-video min-h-11 overflow-hidden rounded-lg bg-black/20 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                    onClick={() => {
                                                        openedScreenshotIndexRef.current = i;
                                                        setSelectedImageIndex(i);
                                                    }}
                                                >
                                                    <Image
                                                        src={ss.thumbnail}
                                                        alt={`Screenshot ${i + 1}`}
                                                        fill
                                                        className={cn(
                                                            "object-cover transition-all duration-500 group-hover:scale-110",
                                                            shouldBlurImage(ss.sexual, nsfwBlur) && "blur-xl"
                                                        )}
                                                        sizes="(max-width: 640px) 50vw, 33vw"
                                                    />
                                                    {shouldBlurImage(ss.sexual, nsfwBlur) && (
                                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
                                                            <Badge variant="destructive" className="bg-red-600/80 text-[10px] h-5 px-1.5 py-0">{t.settings.imageBlurred}</Badge>
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Accordion>



                        <Accordion
                            title={<div className="flex items-center gap-2"><BookOpen className="w-5 h-5 text-gray-400" /> {t.vn.memoPrivate}</div>}
                        >
                            <ErrorBoundary>
                                <MarkdownEditor
                                    value={notes}
                                    onChange={(val) => { setNotes(val); setIsDirty(true); }}
                                    height="h-80"
                                    placeholder={t.vn.memoPlaceholder}
                                />
                            </ErrorBoundary>
                        </Accordion>

                        <Accordion
                            title={<div className="flex items-center gap-2"><MessageSquare className="w-5 h-5 text-accent" /> {t.vn.review}</div>}
                        >
                            <ErrorBoundary>
                                <MarkdownEditor
                                    value={review}
                                    onChange={(val) => { setReview(val); setIsDirty(true); }}
                                    height="h-80"
                                    placeholder={t.vn.reviewPlaceholder}
                                />
                            </ErrorBoundary>
                        </Accordion>
                    </div>
                </motion.div>
            </div>

            <Dialog
                open={selectedImageIndex !== null}
                onOpenChange={(open) => {
                    if (!open) setSelectedImageIndex(null);
                }}
            >
                {selectedImageIndex !== null && vn?.screenshots && (
                    <DialogContent
                        showCloseButton={false}
                        onCloseAutoFocus={(event) => {
                            event.preventDefault();
                            const openedIndex = openedScreenshotIndexRef.current;
                            if (openedIndex !== null) {
                                screenshotButtonRefs.current[openedIndex]?.focus();
                            }
                        }}
                        className="block h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] max-w-[calc(100vw-1rem)] overflow-hidden border-white/10 bg-black/95 p-0 sm:h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-2rem)] sm:max-w-[calc(100vw-2rem)]"
                    >
                        <DialogTitle className="sr-only">
                            {t.common.screenshots} {selectedImageIndex + 1}
                        </DialogTitle>

                        <DialogClose asChild>
                            <button
                                type="button"
                                aria-label={t.common.close}
                                className="absolute right-3 top-3 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                            >
                                <X className="w-6 h-6" aria-hidden="true" />
                            </button>
                        </DialogClose>

                        <button
                            type="button"
                            aria-label={t.common.previousImage}
                            onClick={() => {
                                setSelectedImageIndex((prev) => (prev !== null ? (prev - 1 + vn.screenshots.length) % vn.screenshots.length : null));
                            }}
                            className="absolute left-3 top-1/2 z-50 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        >
                            <ChevronLeft className="w-7 h-7" aria-hidden="true" />
                        </button>

                        <button
                            type="button"
                            aria-label={t.common.nextImage}
                            onClick={() => {
                                setSelectedImageIndex((prev) => (prev !== null ? (prev + 1) % vn.screenshots.length : null));
                            }}
                            className="absolute right-3 top-1/2 z-50 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        >
                            <ChevronRight className="w-7 h-7" aria-hidden="true" />
                        </button>

                        <div className="relative h-full w-full p-4 sm:p-8">
                            <Image
                                src={vn.screenshots[selectedImageIndex].url}
                                alt={`${t.common.screenshots} ${selectedImageIndex + 1}`}
                                fill
                                className={cn(
                                    "object-contain transition-all duration-300",
                                    shouldBlurImage(vn.screenshots[selectedImageIndex].sexual, nsfwBlur) && "blur-3xl"
                                )}
                                sizes="100vw"
                            />
                            {shouldBlurImage(vn.screenshots[selectedImageIndex].sexual, nsfwBlur) && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                                    <Badge variant="destructive" className="bg-red-600 text-white border-none shadow-xl px-6 py-3 text-2xl font-bold">{t.settings.imageBlurred}</Badge>
                                    <p className="text-white/80 text-sm bg-black/40 px-4 py-2 rounded-full backdrop-blur-md">
                                        {t.settings?.nsfwBlurDescription || "NSFW content is hidden"}
                                    </p>
                                </div>
                            )}
                        </div>
                    </DialogContent>
                )}
            </Dialog>
        </div>
    );
}

function RecordDateInput({
    id,
    label,
    value,
    onChange,
    todayLabel,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    todayLabel?: string;
}) {
    return (
        <div className="space-y-2">
            <Label htmlFor={id}>{label}</Label>
            <div className="flex gap-2">
                <Input id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} />
                {todayLabel && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onChange(new Date().toLocaleDateString("en-CA"))}
                    >
                        {todayLabel}
                    </Button>
                )}
            </div>
        </div>
    );
}
