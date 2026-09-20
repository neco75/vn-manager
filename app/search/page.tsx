"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { searchVNs } from "@/lib/vndb";
import { VN } from "@/types/vndb";
import { SearchBar } from "@/components/SearchBar";
import { VNCard } from "@/components/VNCard";
import { useLibrary } from "@/context/LibraryContext";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { GameStatus, GAME_STATUSES } from "@/types/library";

type SearchState = "idle" | "searching" | "success" | "empty" | "error";

export default function SearchPage() {
    return (
        <Suspense fallback={<div className="flex justify-center py-20">{null}</div>}>
            <SearchPageInner />
        </Suspense>
    );
}

function SearchPageInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { addItem, getItem } = useLibrary();
    const { t } = useLanguage();

    // 入力中の検索語と、送信済みの検索語を分けて持つ（URLに保持するのは送信済み）
    const [inputValue, setInputValue] = useState(() => searchParams.get("q") ?? "");
    const [activeQuery, setActiveQuery] = useState(() => searchParams.get("q")?.trim() ?? "");
    const [results, setResults] = useState<VN[]>([]);
    const [page, setPage] = useState(1);
    const [more, setMore] = useState(false);
    const [searchState, setSearchState] = useState<SearchState>(
        () => (searchParams.get("q")?.trim() ? "searching" : "idle"),
    );
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [loadMoreError, setLoadMoreError] = useState(false);
    const [addingIds, setAddingIds] = useState<string[]>([]);
    // 状態を指定したい場合だけ開く任意の追加フォーム
    const [statusPickerVN, setStatusPickerVN] = useState<VN | null>(null);
    const [statusPickerValue, setStatusPickerValue] = useState<GameStatus>("plan_to_play");

    // 遅い旧クエリが新しい結果を上書きしないためのシーケンス番号
    const searchSequenceRef = useRef(0);

    const applyPage = useCallback((current: VN[], incoming: VN[]) => {
        const seen = new Set(current.map((vn) => vn.id));
        const deduped = incoming.filter((vn) => !seen.has(vn.id));
        return [...current, ...deduped];
    }, []);

    const runSearch = useCallback(
        async (query: string) => {
            const trimmed = query.trim();
            if (!trimmed) return;

            const sequence = ++searchSequenceRef.current;
            setSearchState("searching");
            setResults([]);
            setPage(1);
            setMore(false);
            setLoadMoreError(false);

            try {
                const firstPage = await searchVNs(trimmed, { page: 1 });
                if (searchSequenceRef.current !== sequence) return; // より新しい検索が走っている

                setResults(applyPage([], firstPage.results));
                setMore(firstPage.more);
                setPage(1);
                setSearchState(firstPage.results.length === 0 ? "empty" : "success");
            } catch (error) {
                if (searchSequenceRef.current !== sequence) return;
                console.error("Search failed:", error);
                setResults([]);
                setMore(false);
                setSearchState("error");
            }
        },
        [applyPage],
    );

    // URLの検索語（送信済み）を初期値として検索を実行する
    const mountedRef = useRef(false);
    useEffect(() => {
        if (mountedRef.current) return;
        mountedRef.current = true;
        if (activeQuery) {
            void runSearch(activeQuery);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        const trimmed = inputValue.trim();
        if (!trimmed) return; // 空白検索は送らない

        setActiveQuery(trimmed);
        // 検索語をURLへ保持（履歴を過剰追加しないよう replace）。詳細から戻った時に復元できる
        router.replace(`/search?q=${encodeURIComponent(trimmed)}`, { scroll: false });
        void runSearch(trimmed);
    };

    const handleLoadMore = async () => {
        if (isLoadingMore || !more || !activeQuery) return;
        setIsLoadingMore(true);
        setLoadMoreError(false);
        const sequence = searchSequenceRef.current;
        const nextPage = page + 1;

        try {
            const next = await searchVNs(activeQuery, { page: nextPage });
            if (searchSequenceRef.current !== sequence) return;
            setResults((current) => applyPage(current, next.results));
            setMore(next.more);
            setPage(nextPage);
        } catch (error) {
            if (searchSequenceRef.current !== sequence) return;
            console.error("Load more failed:", error);
            // 取得済みの結果は消さない
            setLoadMoreError(true);
        } finally {
            if (searchSequenceRef.current === sequence) {
                setIsLoadingMore(false);
            }
        }
    };

    // 未登録作品は既定のプレイ予定で簡単に追加。登録済みは二重追加せずスキップ
    const handleAdd = async (vn: VN, status: GameStatus = "plan_to_play") => {
        if (addingIds.includes(vn.id)) return;
        if (getItem(vn.id)) {
            toast.success(t.search.addedToast.replace("{title}", vn.title));
            return;
        }

        setAddingIds((prev) => [...prev, vn.id]);
        try {
            await addItem(vn, { status, ownership: "unknown", score: null, notes: "" });
            toast.success(t.search.addedToast.replace("{title}", vn.title));
        } catch (error) {
            console.error("Failed to add to library:", error);
            toast.error(t.modal.saveError);
        } finally {
            setAddingIds((prev) => prev.filter((id) => id !== vn.id));
        }
    };

    const statusOptions = GAME_STATUSES.map((value) => ({ value, label: t.status[value] }));

    return (
        <div className="space-y-8 max-w-6xl mx-auto">
            <div className="space-y-3">
                <h1 className="text-2xl font-bold">{t.search.title}</h1>
                <p className="text-muted-foreground text-sm">{t.search.subtitle}</p>

                <form onSubmit={handleSubmit} className="flex gap-2" role="search">
                    <div className="flex-1">
                        <Label htmlFor="vn-search" className="sr-only">
                            {t.search.searchLabel}
                        </Label>
                        <SearchBar
                            id="vn-search"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder={t.search.searchLabel}
                            className="w-full"
                        />
                    </div>
                    <Button type="submit" disabled={searchState === "searching"} className="min-h-11 shrink-0 gap-1.5">
                        {searchState === "searching" ? (
                            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                        ) : null}
                        {t.search.searchButton}
                    </Button>
                </form>
            </div>

            {/* 状態: 初期 / 検索中 / 0件 / 失敗 / 結果あり を区別する */}
            {searchState === "idle" && (
                <p className="text-muted-foreground text-sm">{t.search.initialHint}</p>
            )}

            {searchState === "searching" && (
                <div className="flex justify-center py-12" role="status" aria-label={t.common.loading}>
                    <Loader2 className="w-8 h-8 animate-spin text-primary" aria-hidden="true" />
                </div>
            )}

            {searchState === "empty" && (
                <div className="rounded-xl border border-border bg-card p-6 text-center space-y-2">
                    <p className="font-medium">{t.search.emptyTitle.replace("{query}", activeQuery)}</p>
                    <p className="text-muted-foreground text-sm">{t.search.emptyDesc}</p>
                </div>
            )}

            {searchState === "error" && (
                <div className="rounded-xl border border-border bg-card p-6 text-center space-y-3">
                    <p className="font-medium">{t.search.errorTitle}</p>
                    <p className="text-muted-foreground text-sm">{t.search.errorDesc}</p>
                    <Button variant="outline" className="min-h-11" onClick={() => void runSearch(activeQuery)}>
                        {t.search.retry}
                    </Button>
                </div>
            )}

            {searchState === "success" && results.length > 0 && (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                        {results.map((vn) => {
                            const libraryItem = getItem(vn.id);
                            return (
                                <div key={vn.id} className="flex flex-col gap-2">
                                    <VNCard
                                        vn={vn}
                                        libraryItem={libraryItem}
                                        variant="search"
                                        onAdd={() => void handleAdd(vn)}
                                        isAdding={addingIds.includes(vn.id)}
                                    />
                                    {/* 状態を指定したい場合だけ任意の追加フォームを開く */}
                                    {!libraryItem && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="min-h-11 w-full text-muted-foreground hover:text-foreground"
                                            onClick={() => {
                                                setStatusPickerVN(vn);
                                                setStatusPickerValue("plan_to_play");
                                            }}
                                        >
                                            <Plus className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                                            {t.common.status}
                                        </Button>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {more && (
                        <div className="flex flex-col items-center gap-2 pt-2">
                            {loadMoreError && (
                                <p role="alert" className="text-sm text-destructive">
                                    {t.search.loadMoreError}
                                </p>
                            )}
                            <Button
                                variant="outline"
                                className="min-h-11 gap-2"
                                onClick={() => void handleLoadMore()}
                                disabled={isLoadingMore}
                            >
                                {isLoadingMore ? (
                                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                                ) : null}
                                {isLoadingMore ? t.search.loadingMore : t.search.loadMore}
                            </Button>
                        </div>
                    )}
                </>
            )}

            {/* 任意の状態指定（評価・時間・メモは必須にしない）。状態を選んで追加 */}
            {statusPickerVN && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label={t.common.status}
                    className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
                    onClick={() => setStatusPickerVN(null)}
                >
                    <div
                        className="w-full max-w-sm rounded-xl border border-border bg-card p-6 space-y-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="font-bold leading-snug">{statusPickerVN.title}</h2>
                        <div className="space-y-2">
                            <Label htmlFor="add-status">{t.common.status}</Label>
                            <Select value={statusPickerValue} onValueChange={(value) => setStatusPickerValue(value as GameStatus)}>
                                <SelectTrigger id="add-status" className="w-full min-h-11">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {statusOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                className="min-h-11 flex-1"
                                onClick={() => setStatusPickerVN(null)}
                            >
                                {t.common.cancel}
                            </Button>
                            <Button
                                className="min-h-11 flex-1 gap-1.5"
                                disabled={addingIds.includes(statusPickerVN.id)}
                                onClick={() => {
                                    void handleAdd(statusPickerVN, statusPickerValue).then(() => setStatusPickerVN(null));
                                }}
                            >
                                {addingIds.includes(statusPickerVN.id) ? (
                                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                                ) : null}
                                {t.common.addToLibrary}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
