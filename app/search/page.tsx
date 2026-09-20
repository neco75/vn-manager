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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
    // 追加失敗を操作の近くに表示する（vn.idごと）
    const [addErrors, setAddErrors] = useState<Record<string, string>>({});
    // 状態を指定したい場合だけ開く任意の追加フォーム
    const [statusPickerVN, setStatusPickerVN] = useState<VN | null>(null);
    const [statusPickerValue, setStatusPickerValue] = useState<GameStatus>("plan_to_play");

    // 遅い旧クエリが新しい結果を上書きしないためのシーケンス番号
    const searchSequenceRef = useRef(0);
    // 「もっと見る」の通信を新検索開始時に中断するための制御
    const loadMoreAbortRef = useRef<AbortController | null>(null);
    // R4: 状態指定フォームを開いた起点（ボタン）を保持し、閉じた後にフォーカスを戻す
    const statusTriggerRef = useRef<HTMLButtonElement | null>(null);

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
            // R1: 前検索の「もっと見る」処理を中断し、残留したloading状態を必ずリセットする
            loadMoreAbortRef.current?.abort();
            loadMoreAbortRef.current = null;
            setIsLoadingMore(false);

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
        const controller = new AbortController();
        loadMoreAbortRef.current = controller;

        try {
            const next = await searchVNs(activeQuery, { page: nextPage, signal: controller.signal });
            if (searchSequenceRef.current !== sequence) return;
            setResults((current) => applyPage(current, next.results));
            setMore(next.more);
            setPage(nextPage);
        } catch (error) {
            // 新しい検索開始時に中断された場合は失敗扱いにしない
            if (searchSequenceRef.current !== sequence || isAbortError(error)) return;
            console.error("Load more failed:", error);
            // 取得済みの結果は消さない
            setLoadMoreError(true);
        } finally {
            // R1: 同じ検索が続いている場合だけ状態を戻す（新検索ではrunSearchで必ず戻す）
            if (searchSequenceRef.current === sequence && loadMoreAbortRef.current === controller) {
                loadMoreAbortRef.current = null;
                setIsLoadingMore(false);
            }
        }
    };

    function isAbortError(error: unknown): boolean {
        return error instanceof DOMException && error.name === "AbortError";
    }

    // 未登録作品は既定のプレイ予定で簡単に追加。登録済みは二重追加せずスキップ。
    // 成功/失敗を呼び出し側に返し、失敗は操作の近くに表示する（toastだけにしない）
    const handleAdd = async (vn: VN, status: GameStatus = "plan_to_play"): Promise<boolean> => {
        if (addingIds.includes(vn.id)) return false;
        if (getItem(vn.id)) {
            toast.success(t.search.addSuccess.replace("{title}", vn.title));
            return true;
        }

        setAddingIds((prev) => [...prev, vn.id]);
        setAddErrors((prev) => {
            if (!prev[vn.id]) return prev;
            const next = { ...prev };
            delete next[vn.id];
            return next;
        });
        try {
            await addItem(vn, { status, ownership: "unknown", score: null, notes: "" });
            toast.success(t.search.addSuccess.replace("{title}", vn.title));
            return true;
        } catch (error) {
            console.error("Failed to add to library:", error);
            toast.error(t.modal.saveError);
            setAddErrors((prev) => ({ ...prev, [vn.id]: t.search.addError }));
            return false;
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

                {/* design.md §6: 検索欄に可視ラベルと「検索」ボタン */}
                <form onSubmit={handleSubmit} className="space-y-2" role="search">
                    <Label htmlFor="vn-search" className="text-sm font-medium">
                        {t.search.searchLabel}
                    </Label>
                    <div className="flex gap-2">
                        <SearchBar
                            id="vn-search"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder={t.search.searchLabel}
                            className="flex-1"
                        />
                        <Button type="submit" disabled={searchState === "searching"} className="min-h-11 shrink-0 gap-1.5">
                            {searchState === "searching" ? (
                                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                            ) : null}
                            {t.search.searchButton}
                        </Button>
                    </div>
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
                                    {/* design.md §6: 保存失敗は同じ操作の近くにも表示する */}
                                    {addErrors[vn.id] && (
                                        <p role="alert" className="text-xs text-destructive">
                                            {addErrors[vn.id]}
                                        </p>
                                    )}
                                    {/* 状態を指定したい場合だけ任意の追加フォームを開く */}
                                    {!libraryItem && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="min-h-11 w-full text-muted-foreground hover:text-foreground"
                                            onClick={(event) => {
                                                statusTriggerRef.current = event.currentTarget;
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

            {/* 任意の状態指定（評価・時間・メモは必須にしない）。状態を選んで追加。
                R4: 既存Radix Dialogでフォーカストラップ・Esc・フォーカス復帰を揃える */}
            <Dialog
                open={statusPickerVN !== null}
                onOpenChange={(open) => {
                    if (!open) setStatusPickerVN(null);
                }}
            >
                {/* R4: 背景はRadixにより不活性化されるためaria-modalは実挙動と一致する。
                    onCloseAutoFocusで開いた起点へフォーカスを戻す（design.md §10） */}
                <DialogContent
                    aria-modal="true"
                    onCloseAutoFocus={(event) => {
                        event.preventDefault();
                        statusTriggerRef.current?.focus();
                    }}
                    className="max-w-sm rounded-xl border-border bg-card sm:max-w-sm"
                >
                    {statusPickerVN && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="text-left leading-snug">
                                    {statusPickerVN.title}
                                </DialogTitle>
                                <DialogDescription className="text-left">
                                    {t.search.selectStatus}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4">
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

                                {/* design.md §6: 保存失敗は同じ操作の近くにも表示する */}
                                {addErrors[statusPickerVN.id] && (
                                    <p role="alert" className="text-sm text-destructive">
                                        {addErrors[statusPickerVN.id]}
                                    </p>
                                )}

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
                                            void handleAdd(statusPickerVN, statusPickerValue).then((succeeded) => {
                                                // R2: 失敗時は入力と選択を保持し、成功時だけ閉じる
                                                if (succeeded) setStatusPickerVN(null);
                                            });
                                        }}
                                    >
                                        {addingIds.includes(statusPickerVN.id) ? (
                                            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                                        ) : null}
                                        {t.search.addWithStatus}
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
