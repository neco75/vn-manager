import { useState } from "react";
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
}

export function PurchaseLocationSelector({ value, onChange }: PurchaseLocationSelectorProps) {
    const { purchaseSources, addPurchaseSource, updatePurchaseSource, deletePurchaseSource } = useLibrary();
    const { t } = useLanguage();
    const [isAdding, setIsAdding] = useState(false);
    const [newSource, setNewSource] = useState("");

    // Management Modal State
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
            if (value === name) {
                // If the currently selected source is deleted, keep the value as is (it becomes a custom string effectively)
                // or clear it? The requirement said "location name will remain on existing Library Items".
                // Since value is just a string, we don't need to do anything to the value prop itself,
                // but it will no longer be in the list.
            }
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
                        <SelectTrigger className="bg-secondary/50 border-white/10">
                            <SelectValue placeholder="Select location..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {purchaseSources.map((source) => (
                                <SelectItem key={source} value={source}>
                                    {source}
                                </SelectItem>
                            ))}
                            <div className="h-px bg-white/10 my-1" />
                            <SelectItem value="add_new" className="text-accent focus:text-accent font-medium">
                                <div className="flex items-center gap-2">
                                    <Plus className="w-4 h-4" />
                                    Add New...
                                </div>
                            </SelectItem>
                            <SelectItem value="manage_locations" className="text-gray-400 focus:text-white font-medium">
                                <div className="flex items-center gap-2">
                                    <Settings className="w-4 h-4" />
                                    Manage Locations...
                                </div>
                            </SelectItem>
                        </SelectContent>
                    </Select>
                ) : (
                    <div className="flex gap-2">
                        <Input
                            value={newSource}
                            onChange={(e) => setNewSource(e.target.value)}
                            placeholder="Enter location name..."
                            className="bg-secondary/50 border-white/10"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleAddSource();
                                if (e.key === "Escape") setIsAdding(false);
                            }}
                        />
                        <Button size="icon" onClick={handleAddSource} className="shrink-0">
                            <Check className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setIsAdding(false)} className="shrink-0">
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                )}
            </div>

            <Dialog open={isManageOpen} onOpenChange={setIsManageOpen}>
                <DialogContent className="max-w-md bg-card border-white/10">
                    <DialogHeader>
                        <DialogTitle>Manage Purchase Locations</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                        {purchaseSources.length === 0 && (
                            <div className="text-center text-gray-500 py-4">
                                No locations added yet.
                            </div>
                        )}
                        {purchaseSources.map((source) => (
                            <div key={source} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 border border-white/5 hover:border-white/10 transition-colors group">
                                {editingSource === source ? (
                                    <div className="flex items-center gap-2 flex-1">
                                        <Input
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            className="h-8 bg-black/20 border-white/10"
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") handleUpdateSource(source);
                                                if (e.key === "Escape") setEditingSource(null);
                                            }}
                                        />
                                        <Button size="icon" className="h-8 w-8 shrink-0" onClick={() => handleUpdateSource(source)}>
                                            <Check className="w-4 h-4" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setEditingSource(null)}>
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        <span className="font-medium">{source}</span>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 hover:bg-white/10"
                                                onClick={() => {
                                                    setEditingSource(source);
                                                    setEditValue(source);
                                                }}
                                            >
                                                <Edit2 className="w-4 h-4 text-blue-400" />
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 hover:bg-red-500/20"
                                                onClick={() => handleDeleteSource(source)}
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
