import { useState, useEffect } from "react";
import { VN } from "@/types/vndb";
import { LibraryItem, GameStatus } from "@/types/library";
import { Trash2, Save } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";

import { PurchaseLocationSelector } from "@/components/PurchaseLocationSelector";

interface EditModalProps {
    vn: VN;
    libraryItem?: LibraryItem;
    isOpen: boolean;
    onClose: () => void;
    onSave: (status: GameStatus, score: number, notes: string, playTime: number, purchaseLocation?: string) => void;
    onDelete?: () => void;
}

export function EditModal({ vn, libraryItem, isOpen, onClose, onSave, onDelete }: EditModalProps) {
    const { t } = useLanguage();
    const [status, setStatus] = useState<GameStatus>(libraryItem?.status || "plan_to_play");
    const [score, setScore] = useState(libraryItem?.score || 0);
    const [notes, setNotes] = useState(libraryItem?.notes || "");
    const [playTime, setPlayTime] = useState(libraryItem?.playTime || 0);
    const [purchaseLocation, setPurchaseLocation] = useState(libraryItem?.purchaseLocation || "");

    const statuses: { value: GameStatus; label: string }[] = [
        { value: "playing", label: t.status.playing },
        { value: "completed", label: t.status.completed },
        { value: "watched", label: t.status.watched },
        { value: "on_hold", label: t.status.on_hold },
        { value: "dropped", label: t.status.dropped },
        { value: "plan_to_play", label: t.status.plan_to_play },
    ];

    useEffect(() => {
        if (isOpen) {
            setStatus(libraryItem?.status || "plan_to_play");
            setScore(libraryItem?.score || 0);
            setNotes(libraryItem?.notes || "");
            setPlayTime(libraryItem?.playTime || 0);
            setPurchaseLocation(libraryItem?.purchaseLocation || "");
        }
    }, [isOpen, libraryItem]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-lg bg-card border-white/10 p-0 overflow-hidden gap-0 sm:rounded-2xl">
                <div className="relative h-32 w-full">
                    {vn.image ? (
                        <img src={vn.image.url} alt="" className="w-full h-full object-cover opacity-50" />
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

                <div className="p-6 space-y-6">
                    <div className="space-y-2">
                        <Label>{t.common.status}</Label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {statuses.map((s) => (
                                <Button
                                    key={s.value}
                                    variant={status === s.value ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setStatus(s.value)}
                                    className={cn(
                                        "w-full",
                                        status === s.value ? "font-bold" : "border-white/10 text-gray-400 hover:text-white hover:bg-white/5"
                                    )}
                                >
                                    {s.label}
                                </Button>
                            ))}
                        </div>
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
                                        if (!isNaN(val) && val >= 0 && val <= 100) setScore(val);
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
                            onValueChange={(vals) => setScore(vals[0])}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>{t.common.playTime} ({t.common.hours})</Label>
                            <Input
                                type="number"
                                min="0"
                                step="0.5"
                                value={playTime ? playTime / 60 : ""}
                                onChange={(e) => setPlayTime(parseFloat(e.target.value) * 60)}
                                className="bg-secondary/50 border-white/10"
                                placeholder="10.5"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Purchase Location</Label>
                            <PurchaseLocationSelector
                                value={purchaseLocation}
                                onChange={setPurchaseLocation}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>{t.common.notes}</Label>
                        <Textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="h-32 bg-secondary/50 border-white/10 resize-none"
                            placeholder={t.modal.placeholder}
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        {libraryItem && onDelete && (
                            <Button
                                variant="destructive"
                                onClick={onDelete}
                                className="flex-1 gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                {t.common.delete}
                            </Button>
                        )}
                        <Button
                            onClick={() => onSave(status, score, notes, playTime, purchaseLocation)}
                            className="flex-[2] gap-2 font-bold shadow-lg shadow-primary/25"
                        >
                            <Save className="w-4 h-4" />
                            {t.common.save}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

