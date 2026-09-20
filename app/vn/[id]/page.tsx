"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useParams, useSearchParams } from "next/navigation";
import { getVNById } from "@/lib/vndb";
import { mergeLibraryItemMetadata, type LibraryItemEdits } from "@/lib/library-state";
import { VN } from "@/types/vndb";
import { useLibrary } from "@/context/LibraryContext";
import { motion } from "framer-motion";
import { ArrowLeft, Star, Clock, Calendar, Tag, Image as ImageIcon, Trash2, Save, BookOpen, ExternalLink, X, ChevronLeft, ChevronRight } from "lucide-react";
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
import {
    readDetailDraft,
    removeDetailDraft,
    writeDetailDraft,
    type DetailDraft,
    type DetailDraftValues,
} from "@/lib/detail-draft";

type ExternalFetchState = "idle" | "loading" | "success" | "not-found" | "error";
type DraftStatus = "unsaved" | "saved" | "saving" | "draft-saved" | "error";

interface DraftSnapshot {
    vnId: string;
    baseUpdatedAt: number | null;
    values: DetailDraftValues;
    dirty: boolean;
}

function snapshotToDraft(snapshot: DraftSnapshot): DetailDraft {
    return {
        version: 1,
        vnId: snapshot.vnId,
        baseUpdatedAt: snapshot.baseUpdatedAt,
        updatedAt: Date.now(),
        values: snapshot.values,
    };
}

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
    const [draftStatus, setDraftStatus] = useState<DraftStatus>("unsaved");
    const [pendingDraft, setPendingDraft] = useState<DetailDraft | null>(null);
    const [draftStorageError, setDraftStorageError] = useState(false);
    const [isDraftReady, setIsDraftReady] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
    const screenshotButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const openedScreenshotIndexRef = useRef<number | null>(null);
    const initializedRouteRef = useRef<string | null>(null);
    const requestSequenceRef = useRef(0);
    const draftReadyRef = useRef(false);
    const draftBaseUpdatedAtRef = useRef<number | null>(null);
    const latestDraftRef = useRef<DraftSnapshot | null>(null);

    const STATUSES: { value: GameStatus; label: string }[] = [
        { value: "playing", label: t.status.playing },
        { value: "completed", label: t.status.completed },
        { value: "watched", label: t.status.watched },
        { value: "on_hold", label: t.status.on_hold },
        { value: "dropped", label: t.status.dropped },
        { value: "plan_to_play", label: t.status.plan_to_play },
    ];

    const libraryItem = routeId ? getItem(routeId) : undefined;
    const formLocked = initializedRouteRef.current !== routeId || !isDraftReady || Boolean(pendingDraft);

    const markDirty = () => {
        if (formLocked) return;
        setIsDirty(true);
        setDraftStatus("unsaved");
    };

    useEffect(() => {
        const previousSnapshot = latestDraftRef.current;
        if (previousSnapshot && previousSnapshot.vnId !== routeId && previousSnapshot.dirty) {
            try {
                writeDetailDraft(snapshotToDraft(previousSnapshot));
            } catch (error) {
                console.error("Failed to save VN draft during navigation:", error);
            }
        }

        draftReadyRef.current = false;
        latestDraftRef.current = null;
        draftBaseUpdatedAtRef.current = null;
        initializedRouteRef.current = null;
        requestSequenceRef.current += 1;
        setVn(null);
        setExternalState("idle");
        setRetryVersion(0);
        setSelectedImageIndex(null);
        setPendingDraft(null);
        setDraftStorageError(false);
        setDraftStatus("unsaved");
        setIsDraftReady(false);
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

        draftBaseUpdatedAtRef.current = libraryItem?.updatedAt ?? null;
        try {
            const draft = readDetailDraft(routeId);
            setPendingDraft(draft);
            setDraftStorageError(false);
            setDraftStatus(draft ? "draft-saved" : libraryItem ? "saved" : "unsaved");
        } catch (error) {
            console.error("Failed to read VN draft:", error);
            setPendingDraft(null);
            setDraftStorageError(true);
            setDraftStatus("error");
        }
        draftReadyRef.current = true;
        setIsDraftReady(true);
    }, [routeId, isLibraryLoading, libraryItem]);

    useEffect(() => {
        if (!routeId || !draftReadyRef.current) return;

        latestDraftRef.current = {
            vnId: routeId,
            baseUpdatedAt: draftBaseUpdatedAtRef.current,
            values: {
                status,
                ownership,
                score,
                notes,
                review,
                playTime,
                purchaseLocation,
                startedOn,
                completedOn,
                lastPlayedOn,
                resumeNote,
            },
            dirty: isDirty,
        };
    }, [
        routeId,
        status,
        ownership,
        score,
        notes,
        review,
        playTime,
        purchaseLocation,
        startedOn,
        completedOn,
        lastPlayedOn,
        resumeNote,
        isDirty,
    ]);

    useEffect(() => {
        if (!routeId || !draftReadyRef.current || !isDirty || pendingDraft) return;

        const timeoutId = window.setTimeout(() => {
            const snapshot = latestDraftRef.current;
            if (!snapshot || snapshot.vnId !== routeId || !snapshot.dirty) return;

            setDraftStatus("saving");
            try {
                writeDetailDraft(snapshotToDraft(snapshot));
                setDraftStorageError(false);
                setDraftStatus("draft-saved");
            } catch (error) {
                console.error("Failed to save VN draft:", error);
                setDraftStorageError(true);
                setDraftStatus("error");
            }
        }, 450);

        return () => window.clearTimeout(timeoutId);
    }, [
        routeId,
        status,
        ownership,
        score,
        notes,
        review,
        playTime,
        purchaseLocation,
        startedOn,
        completedOn,
        lastPlayedOn,
        resumeNote,
        isDirty,
        pendingDraft,
    ]);

    useEffect(() => {
        if (!routeId || !isDirty) return;

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            const snapshot = latestDraftRef.current;
            if (snapshot?.dirty) {
                try {
                    writeDetailDraft(snapshotToDraft(snapshot));
                } catch (error) {
                    console.error("Failed to save VN draft before unload:", error);
                }
            }
            event.preventDefault();
            event.returnValue = "";
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [routeId, isDirty]);

    useEffect(() => {
        return () => {
            const snapshot = latestDraftRef.current;
            if (!snapshot?.dirty) return;

            try {
                writeDetailDraft(snapshotToDraft(snapshot));
            } catch (error) {
                console.error("Failed to save VN draft on unmount:", error);
            }
        };
    }, []);

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

    const restoreDraft = () => {
        if (!pendingDraft) return;

        const values = pendingDraft.values;
        draftBaseUpdatedAtRef.current = pendingDraft.baseUpdatedAt;
        setStatus(values.status);
        setOwnership(values.ownership);
        setScore(values.score);
        setNotes(values.notes);
        setReview(values.review);
        setPlayTime(values.playTime);
        setPurchaseLocation(values.purchaseLocation);
        setStartedOn(values.startedOn);
        setCompletedOn(values.completedOn);
        setLastPlayedOn(values.lastPlayedOn);
        setResumeNote(values.resumeNote);
        setPendingDraft(null);
        setDraftStorageError(false);
        setDraftStatus("draft-saved");
        setIsDirty(true);
    };

    const discardDraft = () => {
        if (!pendingDraft || !routeId) return;

        try {
            removeDetailDraft(routeId);
            setPendingDraft(null);
            setDraftStorageError(false);
            setDraftStatus(libraryItem ? "saved" : "unsaved");
        } catch (error) {
            console.error("Failed to discard VN draft:", error);
            setDraftStorageError(true);
            setDraftStatus("error");
        }
    };

    const handleSave = async () => {
        if (!vn || isSaving || formLocked) return;

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

            try {
                removeDetailDraft(vn.id);
                setPendingDraft(null);
                setDraftStorageError(false);
                setDraftStatus("saved");
            } catch (error) {
                console.error("Failed to clear VN draft:", error);
                setDraftStorageError(true);
                setDraftStatus("error");
            }
            latestDraftRef.current = null;
            setIsDirty(false);
        } catch (error) {
            console.error(error);
            toast.error(t.modal.saveError);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!vn || !libraryItem || isDeleting || formLocked) return;
        if (confirm(t.modal.confirmDelete)) {
            setIsDeleting(true);
            try {
                await removeItem(vn.id);
                try {
                    removeDetailDraft(vn.id);
                } catch (error) {
                    console.error("Failed to clear VN draft after delete:", error);
                    setDraftStorageError(true);
                }
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
                setPendingDraft(null);
                setDraftStatus("unsaved");
                latestDraftRef.current = null;
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
    const draftHasConflict = pendingDraft
        ? pendingDraft.baseUpdatedAt !== (libraryItem?.updatedAt ?? null)
        : false;
    const draftStatusLabel = isSaving
        ? t.modal.saving
        : draftStatus === "saving"
            ? t.vn.draftSaving
            : draftStatus === "error"
                ? t.vn.draftSaveError
                : draftStatus === "draft-saved"
                    ? t.vn.draftSaved
                    : isDirty
                        ? t.vn.draftUnsaved
                        : draftStatus === "saved"
                            ? t.vn.recordSaved
                            : t.vn.draftUnsaved;
    const draftStatusClass = draftStatus === "error"
        ? "text-red-300"
        : draftStatus === "draft-saved"
            ? "text-blue-300"
            : isDirty
                ? "text-amber-300"
                : "text-emerald-300";

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

            <div className="mb-6 flex flex-col gap-4 sm:flex-row">
                <div className="order-1 min-w-0 flex-1 sm:order-2">
                    <h1 className="text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">{displayTitle}</h1>
                    {vn.alttitle && vn.alttitle !== displayTitle && (
                        <p className="mt-2 break-words text-sm text-gray-400">{vn.alttitle}</p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                        <Badge variant="secondary">{t.common.status}: {STATUSES.find((item) => item.value === status)?.label}</Badge>
                        <Badge variant="outline">{t.common.ownership}: {t.ownership[ownership]}</Badge>
                    </div>
                </div>
                <div className="relative order-2 h-32 w-20 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-secondary sm:order-1 sm:h-36 sm:w-24">
                    {vn.image ? (
                        <Image
                            src={vn.image.url}
                            alt={displayTitle}
                            fill
                            className={cn(
                                "object-cover",
                                shouldBlurImage(vn.image.sexual, nsfwBlur) && "blur-2xl scale-110"
                            )}
                            sizes="96px"
                            priority
                        />
                    ) : (
                        <div className="flex h-full items-center justify-center p-2 text-center text-xs text-muted-foreground">
                            {t.common.noImage}
                        </div>
                    )}
                </div>
            </div>

            {pendingDraft && (
                <div role="alert" className="mb-6 rounded-lg border border-blue-400/30 bg-blue-950/30 p-4">
                    <p className="font-medium">{t.vn.draftAvailable}</p>
                    {draftHasConflict && (
                        <p className="mt-2 text-sm text-amber-200">{t.vn.draftConflict}</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                        <Button type="button" size="sm" onClick={restoreDraft}>
                            {t.vn.restoreDraft}
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={discardDraft}>
                            {t.vn.discardDraft}
                        </Button>
                    </div>
                </div>
            )}

            <div className="sticky top-2 z-20 mb-6 flex flex-col gap-3 rounded-xl border border-white/10 bg-card/95 p-3 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <div
                        role="status"
                        aria-live="polite"
                        className={cn("text-sm font-medium", draftStatusClass)}
                    >
                        {draftStatusLabel}
                    </div>
                    {draftStorageError && (
                        <p role="alert" className="mt-1 text-sm text-red-300">
                            {t.vn.draftStorageError}
                        </p>
                    )}
                </div>
                <div className="flex shrink-0 gap-2">
                    {libraryItem && (
                        <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={handleDelete}
                            disabled={formLocked || isDeleting || isSaving}
                            aria-label={t.common.delete}
                            title={t.common.delete}
                            className="min-h-11 gap-2"
                        >
                            <Trash2 className="h-4 w-4" />
                            {t.vn.deleteFromLibrary}
                        </Button>
                    )}
                    <Button
                        type="button"
                        className="min-h-11 gap-2 font-bold shadow-lg shadow-primary/25"
                        onClick={handleSave}
                        disabled={formLocked || isSaving || isDeleting || (!!libraryItem && !isDirty)}
                    >
                        <Save className="h-5 w-5" />
                        {isSaving ? t.modal.saving : (libraryItem ? t.common.saveChanges : t.common.addToLibrary)}
                    </Button>
                </div>
            </div>


            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
                {/* Personal record */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                >
                    <div className="bg-card border border-white/10 rounded-xl p-6 space-y-6">
                        <h2 className="text-xl font-bold">{t.vn.selfRecord}</h2>
                        <div className="space-y-2">
                            <Label htmlFor="detail-status">{t.common.status}</Label>
                            <Select value={status} onValueChange={(v) => { setStatus(v as GameStatus); markDirty(); }}>
                                <SelectTrigger disabled={formLocked} id="detail-status" className="min-h-11 w-full bg-secondary/50 border-white/10">
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
                                        disabled={Boolean(pendingDraft)}
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={score ?? ""}
                                        placeholder={t.common.unrated}
                                        onChange={(e) => {
                                            const raw = e.target.value;
                                            setScore(raw === "" ? null : Number(raw));
                                            markDirty();
                                        }}
                                        className="h-11 w-24 text-right font-bold text-white bg-secondary/50 border-white/10"
                                    />
                                    <span className="text-sm text-gray-500">/ 100</span>
                                </div>
                            </div>
                            <Slider
                                disabled={Boolean(pendingDraft)}
                                min={0}
                                max={100}
                                step={1}
                                value={[score ?? 0]}
                                onValueChange={(vals) => { setScore(vals[0]); markDirty(); }}
                                aria-label={t.common.score}
                                className="cursor-pointer"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={Boolean(pendingDraft) || score === null}
                                onClick={() => { setScore(null); markDirty(); }}
                            >
                                {t.common.markUnrated}
                            </Button>
                            <p className="text-xs text-gray-500">{t.common.legacyZeroScoreNote}</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="detail-play-time">{t.common.playTime} ({t.common.hours})</Label>
                            <Input
                                id="detail-play-time"
                                disabled={Boolean(pendingDraft)}
                                type="number"
                                min="0"
                                step="0.5"
                                value={playTime ? playTime / 60 : ""}
                                onChange={(e) => {
                                    const rawValue = e.target.value.trim();
                                    setPlayTime(rawValue === "" ? 0 : Number(rawValue) * 60);
                                    markDirty();
                                }}
                                className="min-h-11 bg-secondary/50 border-white/10"
                                placeholder="0.0"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="detail-purchase-location">{t.common.purchaseLocation}</Label>
                            <PurchaseLocationSelector
                                id="detail-purchase-location"
                                disabled={Boolean(pendingDraft)}
                                value={purchaseLocation}
                                onChange={(v) => { setPurchaseLocation(v); markDirty(); }}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="detail-notes">{t.vn.memoPrivate}</Label>
                            <ErrorBoundary>
                                <MarkdownEditor
                                    id="detail-notes"
                                    ariaLabel={t.vn.memoPrivate}
                                    disabled={Boolean(pendingDraft)}
                                    value={notes}
                                    onChange={(val) => { setNotes(val); markDirty(); }}
                                    height="h-64"
                                    placeholder={t.vn.memoPlaceholder}
                                />
                            </ErrorBoundary>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="detail-review">{t.vn.review}</Label>
                            <ErrorBoundary>
                                <MarkdownEditor
                                    id="detail-review"
                                    ariaLabel={t.vn.review}
                                    disabled={Boolean(pendingDraft)}
                                    value={review}
                                    onChange={(val) => { setReview(val); markDirty(); }}
                                    height="h-64"
                                    placeholder={t.vn.reviewPlaceholder}
                                />
                            </ErrorBoundary>
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
                                            markDirty();
                                        }}
                                    >
                                        <SelectTrigger disabled={Boolean(pendingDraft)} id="detail-ownership" className="min-h-11 w-full bg-secondary/50 border-white/10">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="unknown">{t.ownership.unknown}</SelectItem>
                                            <SelectItem value="owned">{t.ownership.owned}</SelectItem>
                                            <SelectItem value="wishlist">{t.ownership.wishlist}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <RecordDateInput disabled={formLocked} id="detail-started-on" label={t.common.startedOn} value={startedOn} onChange={(value) => { setStartedOn(value); markDirty(); }} />
                                <RecordDateInput disabled={formLocked} id="detail-completed-on" label={t.common.completedOn} value={completedOn} onChange={(value) => { setCompletedOn(value); markDirty(); }} todayLabel={t.common.today} />
                                <RecordDateInput disabled={formLocked} id="detail-last-played-on" label={t.common.lastPlayedOn} value={lastPlayedOn} onChange={(value) => { setLastPlayedOn(value); markDirty(); }} />

                                <div className="space-y-2">
                                    <Label htmlFor="detail-resume-note">{t.common.resumeNote}</Label>
                                    <Input
                                        id="detail-resume-note"
                                        disabled={Boolean(pendingDraft)}
                                        value={resumeNote}
                                        maxLength={200}
                                        onChange={(e) => { setResumeNote(e.target.value); markDirty(); }}
                                        placeholder={t.common.resumeNotePlaceholder}
                                    />
                                </div>
                            </div>
                        </details>

                    </div>
                </motion.div>

                {/* External information */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="space-y-8"
                >
                    <div className="space-y-4">
                        <Accordion
                            title={<div className="flex items-center gap-2"><ExternalLink className="w-5 h-5 text-blue-400" /> {t.vn.externalInfo}</div>}
                        >
                            <div className="space-y-4">
                                <div className="flex flex-wrap gap-2 text-sm">
                                    <Badge variant="secondary" className="gap-2 px-3 py-1.5 text-sm font-normal">
                                        <Star className="h-4 w-4 text-yellow-500" />
                                        <span className="font-bold">{vn.rating ? (vn.rating / 10).toFixed(1) : t.common.unrated}</span>
                                        <span className="text-gray-500">/ 10 (VNDB)</span>
                                    </Badge>
                                    <Badge variant="secondary" className="gap-2 px-3 py-1.5 text-sm font-normal">
                                        <Calendar className="h-4 w-4 text-blue-400" />
                                        <span>{vn.released || t.common.tba}</span>
                                    </Badge>
                                    {vn.length_minutes && (
                                        <Badge variant="secondary" className="gap-2 px-3 py-1.5 text-sm font-normal">
                                            <Clock className="h-4 w-4 text-green-400" />
                                            <span>{Math.round(vn.length_minutes / 60)} {t.common.hoursEstimated}</span>
                                        </Badge>
                                    )}
                                </div>
                                <a
                                    href={`https://vndb.org/${vn.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                    {t.common.viewOnVNDB}
                                </a>
                                {vn.image && (
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        className="w-full gap-2"
                                        onClick={() => {
                                            setBackgroundImage(vn.image?.url || null, vn.image?.sexual ?? null);
                                            toast.success(t.modal.bgSetSuccess);
                                        }}
                                    >
                                        <ImageIcon className="h-4 w-4" />
                                        {t.common.setBackground}
                                    </Button>
                                )}
                            </div>
                        </Accordion>

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
    disabled = false,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    todayLabel?: string;
    disabled?: boolean;
}) {
    return (
        <div className="space-y-2">
            <Label htmlFor={id}>{label}</Label>
            <div className="flex gap-2">
                <Input disabled={disabled} id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} />
                {todayLabel && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled}
                        onClick={() => onChange(new Date().toLocaleDateString("en-CA"))}
                    >
                        {todayLabel}
                    </Button>
                )}
            </div>
        </div>
    );
}
