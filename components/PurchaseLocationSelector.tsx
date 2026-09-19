import { useId, useState } from "react";
import { useLibrary } from "@/context/LibraryContext";
import { useLanguage } from "@/context/LanguageContext";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Check, X, Settings, Edit2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface PurchaseLocationSelectorProps {
    value?: string;
    onChange: (value: string) => void;
    id?: string;
}

export function PurchaseLocationSelector({ value, onChange, id }: PurchaseLocationSelectorProps) {
    const { purchaseSources, addPurchaseSource, updatePurchaseSource, deletePurchaseSource } = useLibrary();
    const { t } = useLanguage();
    const generatedId = useId();
    const controlId = id ?? `purchase-location-${generatedId}`;
    const newSourceId = `${controlId}-new`;
    const [isAdding, setIsAdding] = useState(false);
    const [newSource, setNewSource] = useState("");

    const [isManageOpen, setIsManageOpen] = useState(false);
    const [editingSource, setEditingSource] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");

    const handleAddSource = async () => {
        if (!newSource.trim()) return;

        try {
            await addPurchaseSource(newSource.trim());
            onChange(newSource.trim());
            setNewSource("");
            setIsAdding(false);
            toast.success(t.modal.saveSuccess);
        } catch (error) {
            console.error(error);
            toast.error(t.modal.saveError);
        }
    };

    const handleUpdateSource = async (oldName: string) => {
        if (!editValue.trim() || editValue.trim() === oldName) {
            setEditingSource(null);
            return;
        }

        try {
            await updatePurchaseSource(oldName, editValue.trim());
            if (value === oldName) {
                onChange(editValue.trim());
            }
            setEditingSource(null);
            toast.success(t.modal.saveSuccess);
        } catch (error) {
            console.error(error);
            toast.error(t.modal.saveError);
        }
    };

    const handleDeleteSource = async (name: string) => {
        if (!confirm(t.modal.confirmDelete)) return;

        try {
            await deletePurchaseSource(name);
            toast.success(t.modal.deleteSuccess);
        } catch (error) {
            console.error(error);
            toast.error(t.modal.saveError);
        }
    };

    return (
        <>
            <div className="space-y-2">
                {!isAdding ? (
                    <Select value={value || "none"} onValueChange={(v) => {
                        if (v === "add_new") {
                            setIsAdding(true);
                        } else if (v === "manage_locations") {
                            setIsManageOpen(true);
                        } else {
                            onChange(v === "none" ? "" : v);
                        }
                    }}>
                        <SelectTrigger
                            id={controlId}
                            aria-label={t.common.selectPurchaseLocation}
                            className="min-h-11 w-full bg-secondary/50 border-white/10"
                        >
                            <SelectValue placeholder={t.common.selectPurchaseLocation} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">{t.common.none}</SelectItem>
                            {purchaseSources.map((source) => (
                                <SelectItem key={source} value={source}>
                                    {source}
                                </SelectItem>
                            ))}
                            <div className="h-px bg-white/10 my-1" />
                            <SelectItem value="add_new" className="text-accent focus:text-accent font-medium">
                                <div className="flex items-center gap-2">
                                    <Plus className="w-4 h-4" />
                                    {t.common.addPurchaseLocation}
                                </div>
                            </SelectItem>
                            <SelectItem value="manage_locations" className="text-gray-400 focus:text-white font-medium">
                                <div className="flex items-center gap-2">
                                    <Settings className="w-4 h-4" />
                                    {t.common.managePurchaseLocations}
                                </div>
                            </SelectItem>
                        </SelectContent>
                    </Select>
                ) : (
                    <div className="flex gap-2">
                        <Input
                            id={newSourceId}
                            value={newSource}
                            onChange={(e) => setNewSource(e.target.value)}
                            placeholder={t.common.newPurchaseLocation}
                            aria-label={t.common.newPurchaseLocation}
                            className="min-h-11 min-w-0 bg-secondary/50 border-white/10"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === "Enter") void handleAddSource();
                                if (e.key === "Escape") setIsAdding(false);
                            }}
                        />
                        <Button
                            type="button"
                            size="icon"
                            onClick={() => void handleAddSource()}
                            className="h-11 w-11 shrink-0"
                            aria-label={t.common.confirm}
                        >
                            <Check className="w-4 h-4" />
                        </Button>
                        <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => setIsAdding(false)}
                            className="h-11 w-11 shrink-0"
                            aria-label={t.common.cancel}
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                )}
            </div>

            <Dialog open={isManageOpen} onOpenChange={setIsManageOpen}>
                <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-md overflow-y-auto bg-card border-white/10">
                    <DialogHeader>
                        <DialogTitle>{t.common.managePurchaseLocations}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2">
                        {purchaseSources.length === 0 && (
                            <div className="text-center text-gray-500 py-4">
                                {t.common.noPurchaseLocations}
                            </div>
                        )}
                        {purchaseSources.map((source) => (
                            <div key={source} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-white/5 bg-secondary/30 p-2">
                                {editingSource === source ? (
                                    <div className="flex min-w-0 flex-1 items-center gap-2">
                                        <Input
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            className="min-h-11 min-w-0 bg-black/20 border-white/10"
                                            aria-label={`${t.common.edit}: ${source}`}
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") void handleUpdateSource(source);
                                                if (e.key === "Escape") setEditingSource(null);
                                            }}
                                        />
                                        <Button
                                            type="button"
                                            size="icon"
                                            className="h-11 w-11 shrink-0"
                                            onClick={() => void handleUpdateSource(source)}
                                            aria-label={t.common.confirm}
                                        >
                                            <Check className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            className="h-11 w-11 shrink-0"
                                            onClick={() => setEditingSource(null)}
                                            aria-label={t.common.cancel}
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        <span className="min-w-0 flex-1 truncate font-medium">{source}</span>
                                        <div className="flex shrink-0 items-center gap-1">
                                            <Button
                                                type="button"
                                                size="icon"
                                                variant="ghost"
                                                className="h-11 w-11 hover:bg-white/10"
                                                aria-label={`${t.common.edit}: ${source}`}
                                                onClick={() => {
                                                    setEditingSource(source);
                                                    setEditValue(source);
                                                }}
                                            >
                                                <Edit2 className="w-4 h-4 text-blue-400" />
                                            </Button>
                                            <Button
                                                type="button"
                                                size="icon"
                                                variant="ghost"
                                                className="h-11 w-11 hover:bg-red-500/20"
                                                aria-label={`${t.common.delete}: ${source}`}
                                                onClick={() => void handleDeleteSource(source)}
                                            >
                                                <Trash2 className="w-4 h-4 text-red-400" />
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
