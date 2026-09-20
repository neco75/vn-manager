import { useState, useEffect } from "react";
import { VN } from "@/types/vndb";
import {
    getLibraryValidationError,
    LibraryItem,
    GameStatus,
    OwnershipStatus,
} from "@/types/library";
import type { LibraryItemEdits } from "@/lib/library-state";
import { Loader2, Save, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";
import { useSettings } from "@/context/SettingsContext";
import { shouldBlurImage } from "@/lib/image-safety";
import { PurchaseLocationSelector } from "@/components/PurchaseLocationSelector";

interface EditModalProps {
    vn: VN;
    libraryItem?: LibraryItem;
    isOpen: boolean;
    onClose: () => void;
    onSave: (edits: LibraryItemEdits) => Promise<void>;
    onDelete?: () => void;
}

export function EditModal({ vn, libraryItem, isOpen, onClose, onSave, onDelete }: EditModalProps) {
    const { t } = useLanguage();
    const { nsfwBlur } = useSettings();
    const [status, setStatus] = useState<GameStatus>(libraryItem?.status || "plan_to_play");
    const [ownership, setOwnership] = useState<OwnershipStatus>(libraryItem?.ownership || "unknown");
    const [score, setScore] = useState<number | null>(libraryItem?.score ?? null);
    const [notes, setNotes] = useState(libraryItem?.notes || "");
    const [playTime, setPlayTime] = useState(libraryItem?.playTime || 0);
    const [purchaseLocation, setPurchaseLocation] = useState(libraryItem?.purchaseLocation || "");
    const [startedOn, setStartedOn] = useState(libraryItem?.startedOn || "");
    const [completedOn, setCompletedOn] = useState(libraryItem?.completedOn || "");
    const [lastPlayedOn, setLastPlayedOn] = useState(libraryItem?.lastPlayedOn || "");
    const [resumeNote, setResumeNote] = useState(libraryItem?.resumeNote || "");
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const statuses: { value: GameStatus; label: string }[] = [
        { value: "playing", label: t.status.playing },
        { value: "completed", label: t.status.completed },
        { value: "watched", label: t.status.watched },
        { value: "on_hold", label: t.status.on_hold },
        { value: "dropped", label: t.status.dropped },
        { value: "plan_to_play", label: t.status.plan_to_play },
    ];

    useEffect(() => {
        if (!isOpen) return;
        const timeoutId = window.setTimeout(() => {
            setStatus(libraryItem?.status || "plan_to_play");
            setOwnership(libraryItem?.ownership || "unknown");
            setScore(libraryItem?.score ?? null);
            setNotes(libraryItem?.notes || "");
            setPlayTime(libraryItem?.playTime || 0);
            setPurchaseLocation(libraryItem?.purchaseLocation || "");
            setStartedOn(libraryItem?.startedOn || "");
            setCompletedOn(libraryItem?.completedOn || "");
            setLastPlayedOn(libraryItem?.lastPlayedOn || "");
            setResumeNote(libraryItem?.resumeNote || "");
            setIsSaving(false);
            setSaveError(null);
        }, 0);
        return () => window.clearTimeout(timeoutId);
    }, [isOpen, libraryItem]);

    async function handleSave() {
        if (isSaving) return;

        const edits: LibraryItemEdits = {
            status,
            ownership,
            score,
            notes,
            playTime,
            purchaseLocation: purchaseLocation || undefined,
            startedOn: startedOn || undefined,
            completedOn: completedOn || undefined,
            lastPlayedOn: lastPlayedOn || undefined,
            resumeNote: resumeNote || undefined,
        };
        const invalidField = getLibraryValidationError(edits);
        if (invalidField) {
            const errorMap: Partial<Record<typeof invalidField, string>> = {
                status: t.modal.invalidStatus,
                ownership: t.modal.invalidOwnership,
                score: t.modal.invalidScore,
                playTime: t.modal.invalidPlayTime,
                startedOn: t.modal.invalidDate,
                completedOn: t.modal.invalidDate,
                lastPlayedOn: t.modal.invalidDate,
                dateOrder: t.modal.invalidDateOrder,
                resumeNote: t.modal.invalidResumeNote,
            };
            setSaveError(errorMap[invalidField] || t.modal.saveError);
            return;
        }

        setIsSaving(true);
        setSaveError(null);
        try {
            await onSave(edits);
            onClose();
        } catch (error) {
            console.error("Failed to save library item:", error);
            setSaveError(t.modal.saveError);
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && !isSaving && onClose()}>
            <DialogContent className="grid max-h-[calc(100dvh-1rem)] max-w-lg grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden border-white/10 bg-card p-0 sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl">
                <div className="relative h-32 w-full">
                    {vn.image ? (
                        <img
                            src={vn.image.url}
                            alt=""
                            className={cn(
                                "w-full h-full object-cover opacity-50",
                                shouldBlurImage(vn.image?.sexual, nsfwBlur) && "blur-xl grayscale scale-110"
                            )}
                        />
                    ) : (
                        <div className="w-full h-full bg-secondary" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                    <div className="absolute bottom-4 left-6 z-10">
                        <DialogTitle className="text-2xl font-bold text-white shadow-black drop-shadow-md text-left">
                            {vn.title}
                        </DialogTitle>
                    </div>
                </div>

                <div className="space-y-6 overflow-y-auto p-4 sm:p-6">
                    <fieldset className="space-y-2">
                        <legend className="text-sm font-medium">{t.common.status}</legend>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {statuses.map((s) => (
                                <Button
                                    key={s.value}
                                    variant={status === s.value ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => {
                                        setStatus(s.value);
                                        setSaveError(null);
                                    }}
                                    disabled={isSaving}
                                    className={cn(
                                        "min-h-11 w-full",
                                        status === s.value ? "font-bold" : "border-white/10 text-gray-400 hover:text-white hover:bg-white/5"
                                    )}
                                >
                                    {s.label}
                                </Button>
                            ))}
                        </div>
                    </fieldset>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between gap-3">
                            <Label htmlFor="edit-score">{t.common.score}</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    id="edit-score"
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={score ?? ""}
                                    onChange={(e) => {
                                        const raw = e.target.value;
                                        setScore(raw === "" ? null : Number(raw));
                                        setSaveError(null);
                                    }}
                                    disabled={isSaving}
                                    placeholder={t.common.unrated}
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
                            onValueChange={(vals) => {
                                setScore(vals[0]);
                                setSaveError(null);
                            }}
                            disabled={isSaving}
                            aria-label={t.common.score}
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setScore(null)}
                            disabled={isSaving || score === null}
                        >
                            {t.common.markUnrated}
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="edit-play-time">{t.common.playTime} ({t.common.hours})</Label>
                            <Input
                                id="edit-play-time"
                                type="number"
                                min="0"
                                step="0.5"
                                value={playTime ? playTime / 60 : ""}
                                onChange={(e) => {
                                    const rawValue = e.target.value.trim();
                                    setPlayTime(rawValue === "" ? 0 : Number(rawValue) * 60);
                                    setSaveError(null);
                                }}
                                disabled={isSaving}
                                className="min-h-11 bg-secondary/50 border-white/10"
                                placeholder="10.5"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-purchase-location">{t.common.purchaseLocation}</Label>
                            <PurchaseLocationSelector
                                id="edit-purchase-location"
                                value={purchaseLocation}
                                onChange={(value) => {
                                    setPurchaseLocation(value);
                                    setSaveError(null);
                                }}
                            />
                        </div>
                    </div>

                    <details className="rounded-lg border border-white/10 p-4">
                        <summary className="cursor-pointer font-medium">{t.common.recordDetails}</summary>
                        <div className="mt-4 space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-ownership">{t.common.ownership}</Label>
                                <select
                                    id="edit-ownership"
                                    value={ownership}
                                    onChange={(e) => setOwnership(e.target.value as OwnershipStatus)}
                                    disabled={isSaving}
                                    className="min-h-11 w-full rounded-md border border-white/10 bg-secondary/50 px-3 text-sm"
                                >
                                    <option value="unknown">{t.ownership.unknown}</option>
                                    <option value="owned">{t.ownership.owned}</option>
                                    <option value="wishlist">{t.ownership.wishlist}</option>
                                </select>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <DateField id="edit-started-on" label={t.common.startedOn} value={startedOn} onChange={setStartedOn} disabled={isSaving} />
                                <DateField id="edit-completed-on" label={t.common.completedOn} value={completedOn} onChange={setCompletedOn} disabled={isSaving} todayLabel={t.common.today} />
                                <DateField id="edit-last-played-on" label={t.common.lastPlayedOn} value={lastPlayedOn} onChange={setLastPlayedOn} disabled={isSaving} />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit-resume-note">{t.common.resumeNote}</Label>
                                <Input
                                    id="edit-resume-note"
                                    value={resumeNote}
                                    maxLength={200}
                                    onChange={(e) => setResumeNote(e.target.value)}
                                    disabled={isSaving}
                                    placeholder={t.common.resumeNotePlaceholder}
                                />
                            </div>
                        </div>
                    </details>

                    <div className="space-y-2">
                        <Label htmlFor="edit-notes">{t.common.notes}</Label>
                        <Textarea
                            id="edit-notes"
                            value={notes}
                            onChange={(e) => {
                                setNotes(e.target.value);
                                setSaveError(null);
                            }}
                            disabled={isSaving}
                            className="h-32 bg-secondary/50 border-white/10 resize-none"
                            placeholder={t.modal.placeholder}
                        />
                    </div>

                    {saveError && (
                        <p role="alert" className="text-sm text-destructive">
                            {saveError}
                        </p>
                    )}

                    <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                        {libraryItem && onDelete && (
                            <Button
                                variant="destructive"
                                onClick={onDelete}
                                disabled={isSaving}
                                className="min-h-11 flex-1 gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                {t.common.delete}
                            </Button>
                        )}
                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="min-h-11 flex-[2] gap-2 font-bold shadow-lg shadow-primary/25"
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {isSaving ? t.modal.saving : t.common.save}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function DateField({
    id,
    label,
    value,
    onChange,
    disabled,
    todayLabel,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    disabled: boolean;
    todayLabel?: string;
}) {
    return (
        <div className="space-y-2">
            <Label htmlFor={id}>{label}</Label>
            <div className="flex gap-2">
                <Input
                    id={id}
                    type="date"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                />
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
