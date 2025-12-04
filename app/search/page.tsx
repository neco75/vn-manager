"use client";

import { useState } from "react";
import { searchVNs } from "@/lib/vndb";
import { VN } from "@/types/vndb";
import { SearchBar } from "@/components/SearchBar";
import { VNCard } from "@/components/VNCard";
import dynamic from "next/dynamic";

const EditModal = dynamic(() => import("@/components/EditModal").then(mod => mod.EditModal), {
    ssr: false,
});
import { useLibrary } from "@/context/LibraryContext";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";

export default function SearchPage() {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<VN[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedVN, setSelectedVN] = useState<VN | null>(null);
    const { addItem, getItem } = useLibrary();
    const { t } = useLanguage();

    async function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        if (!query.trim()) return;

        setIsSearching(true);
        try {
            const data = await searchVNs(query);
            setResults(data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSearching(false);
        }
    }

    return (
        <div className="space-y-8 max-w-6xl mx-auto">
            <div className="text-center space-y-4 py-8">
                <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
                    {t.search.title}
                </h1>
                <p className="text-gray-400">{t.search.subtitle}</p>
                <form onSubmit={handleSearch} className="max-w-xl mx-auto">
                    <SearchBar
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="shadow-2xl shadow-primary/10"
                        placeholder={t.search.placeholder}
                    />
                </form>
            </div>

            {isSearching ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {results.map((vn) => {
                        const libraryItem = getItem(vn.id);
                        return (
                            <VNCard
                                key={vn.id}
                                vn={vn}
                                libraryItem={libraryItem}
                                onClick={() => setSelectedVN(vn)}
                                className={libraryItem ? "opacity-75" : ""}
                            />
                        );
                    })}
                </div>
            )}

            {selectedVN && (
                <EditModal
                    isOpen={!!selectedVN}
                    vn={selectedVN}
                    libraryItem={getItem(selectedVN.id)}
                    onClose={() => setSelectedVN(null)}
                    onSave={async (status, score, notes, playTime, purchaseLocation) => {
                        const existing = getItem(selectedVN.id);
                        if (existing) {
                            // Usually handled in library
                        } else {
                            await addItem(selectedVN, status, score, notes, playTime, "", purchaseLocation);
                            toast.success(t.search.addedToast.replace("{title}", selectedVN.title));
                        }
                        setSelectedVN(null);
                    }}
                />
            )}
        </div>
    );
}
