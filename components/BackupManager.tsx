"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { Download, Loader2, Save, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/context/LanguageContext";
import { useLibrary } from "@/context/LibraryContext";
import { useSettings } from "@/context/SettingsContext";
import {
    createBackupDocument,
    createRestorePreview,
    parseBackup,
    type ParsedBackup,
    type RestorePreview,
} from "@/lib/backup";
import * as db from "@/lib/db";

interface ImportState {
    backup: ParsedBackup;
    preview: RestorePreview;
}

const LAST_EXPORT_AT_KEY = "vn-manager-last-export-at";

export function BackupManager({ id }: { id?: string }) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const overwriteId = useId();
    const { reloadLibrary } = useLibrary();
    const { language, setLanguage, t } = useLanguage();
    const { backgroundImage, nsfwBlur, setBackgroundImage, setNsfwBlur } = useSettings();
    const [importState, setImportState] = useState<ImportState | null>(null);
    const [overwriteConflicts, setOverwriteConflicts] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);
    const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
    const [lastExportAt, setLastExportAt] = useState<string | null>(null);

    useEffect(() => {
        setLastExportAt(localStorage.getItem(LAST_EXPORT_AT_KEY));
    }, []);

    const formatExportDate = (value: string) => {
        const date = new Date(value);
        if (!Number.isFinite(date.getTime())) return value;

        return new Intl.DateTimeFormat(language === "ja" ? "ja-JP" : "en-US", {
            dateStyle: "medium",
            timeStyle: "short",
        }).format(date);
    };

    const exportData = async () => {
        try {
            const exportedAt = new Date();
            const [library, sourceRows] = await Promise.all([
                db.getAllLibraryItems(),
                db.getAllPurchaseSources(),
            ]);
            const data = createBackupDocument(
                library,
                sourceRows.map((source) => source.name),
                {
                    language,
                    backgroundImage,
                    nsfwBlur,
                },
                exportedAt,
            );
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `vn-manager-backup-${new Date().toISOString().split("T")[0]}.json`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(url);
            const exportedAtValue = exportedAt.toISOString();
            localStorage.setItem(LAST_EXPORT_AT_KEY, exportedAtValue);
            setLastExportAt(exportedAtValue);
            setMessage({ kind: "success", text: t.stats.toasts.exportSuccess });
            toast.success(t.stats.toasts.exportSuccess);
        } catch (error) {
            console.error("Backup export failed:", error);
            setMessage({ kind: "error", text: t.stats.toasts.exportError });
            toast.error(t.stats.toasts.exportError);
        }
    };

    const chooseImportFile = () => {
        setMessage(null);
        fileInputRef.current?.click();
    };

    const importData = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;

        setMessage(null);
        try {
            const raw = JSON.parse(await file.text()) as unknown;
            const backup = parseBackup(raw);
            const currentItems = await db.getAllLibraryItems();
            setOverwriteConflicts(false);
            setImportState({
                backup,
                preview: createRestorePreview(backup, currentItems),
            });
        } catch (error) {
            console.error("Backup import validation failed:", error);
            const detail = error instanceof Error ? error.message : t.stats.toasts.importError;
            const text = t.stats.invalidBackup.replace("{message}", detail);
            setMessage({ kind: "error", text });
            toast.error(t.stats.toasts.importError);
        }
    };

    const restoreData = async () => {
        if (!importState || isRestoring) return;

        setIsRestoring(true);
        setMessage(null);
        try {
            const restoreResult = await db.restoreBackupData(
                importState.backup.library,
                importState.backup.purchaseSources,
                overwriteConflicts,
            );

            const partialFailures: string[] = [];
            try {
                await reloadLibrary();
            } catch (error) {
                partialFailures.push(t.stats.libraryReloadFailed);
                console.error("Library reload after restore failed:", error);
            }

            if (importState.backup.settings) {
                const settings = importState.backup.settings;
                let settingsFailed = false;
                for (const apply of [
                    () => setBackgroundImage(settings.backgroundImage),
                    () => setNsfwBlur(settings.nsfwBlur),
                    () => setLanguage(settings.language),
                ]) {
                    try {
                        apply();
                    } catch (error) {
                        settingsFailed = true;
                        console.error("Backup setting restore failed:", error);
                    }
                }
                if (settingsFailed) partialFailures.push(t.stats.settingsRestoreFailed);
            }

            setImportState(null);
            if (partialFailures.length > 0) {
                const partialText = t.stats.importPartialError.replace(
                    "{details}",
                    partialFailures.join(" / "),
                );
                setMessage({ kind: "error", text: partialText });
                toast.error(t.stats.toasts.importPartialError);
            } else {
                const successText = t.stats.importSuccessDetail
                    .replace("{added}", String(restoreResult.additions))
                    .replace("{conflicts}", String(restoreResult.overwritten));
                setMessage({ kind: "success", text: successText });
                toast.success(t.stats.toasts.importSuccess);
            }
        } catch (error) {
            console.error("Backup restore failed:", error);
            setMessage({ kind: "error", text: t.stats.toasts.importError });
            toast.error(t.stats.toasts.importError);
        } finally {
            setIsRestoring(false);
        }
    };

    return (
        <>
            <Card id={id} className="border-white/10">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Save className="w-5 h-5 text-primary" />
                        {t.settings.dataAndBackup}
                    </CardTitle>
                    <p className="text-sm text-gray-400">{t.settings.localStorageDescription}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <Button
                            variant="outline"
                            onClick={() => void exportData()}
                            className="w-full gap-2 h-12"
                        >
                            <Download className="w-4 h-4" />
                            {t.stats.export}
                        </Button>

                        <div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={(event) => void importData(event)}
                                accept=".json,application/json"
                                className="hidden"
                            />
                            <Button
                                onClick={chooseImportFile}
                                className="w-full gap-2 h-12 shadow-lg shadow-primary/25"
                            >
                                <Upload className="w-4 h-4" />
                                {t.stats.import}
                            </Button>
                        </div>
                    </div>

                    <p className="text-xs text-gray-500 text-center">
                        {t.stats.importWarning}
                    </p>

                    <div className="space-y-1 text-center text-xs text-gray-500">
                        <p>{t.settings.dataAndBackupDescription}</p>
                        <p role="status">
                            {lastExportAt
                                ? t.settings.lastExportAt.replace("{date}", formatExportDate(lastExportAt))
                                : t.settings.noExportYet}
                        </p>
                    </div>

                    {message && (
                        <p
                            role={message.kind === "error" ? "alert" : "status"}
                            className={message.kind === "error" ? "text-sm text-red-300" : "text-sm text-green-300"}
                        >
                            {message.text}
                        </p>
                    )}
                </CardContent>
            </Card>

            <Dialog
                open={importState !== null}
                onOpenChange={(open) => {
                    if (!open && !isRestoring) setImportState(null);
                }}
            >
                <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto bg-card border-white/10">
                    <DialogHeader>
                        <DialogTitle>{t.stats.restorePreviewTitle}</DialogTitle>
                    </DialogHeader>

                    {importState && (
                        <div className="space-y-5">
                            <p className="text-sm text-gray-400">{t.stats.restorePreviewDesc}</p>

                            <dl className="grid grid-cols-2 gap-3 text-sm">
                                <div className="rounded-lg bg-secondary/40 p-3">
                                    <dt className="text-gray-400">{t.stats.backupFormat}</dt>
                                    <dd className="font-semibold">
                                        {importState.backup.legacy
                                            ? t.stats.legacyBackup
                                            : t.stats.versionedBackup.replace("{version}", String(importState.backup.schemaVersion))}
                                    </dd>
                                </div>
                                <div className="rounded-lg bg-secondary/40 p-3">
                                    <dt className="text-gray-400">{t.stats.backupItems}</dt>
                                    <dd className="font-semibold">{importState.preview.total}</dd>
                                </div>
                                <div className="rounded-lg bg-secondary/40 p-3">
                                    <dt className="text-gray-400">{t.stats.additions}</dt>
                                    <dd className="font-semibold">{importState.preview.additions}</dd>
                                </div>
                                <div className="rounded-lg bg-secondary/40 p-3">
                                    <dt className="text-gray-400">{t.stats.conflicts}</dt>
                                    <dd className="font-semibold">{importState.preview.conflicts}</dd>
                                </div>
                            </dl>

                            {importState.preview.conflicts > 0 && (
                                <label
                                    htmlFor={overwriteId}
                                    className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-white/10 p-3"
                                >
                                    <input
                                        id={overwriteId}
                                        type="checkbox"
                                        checked={overwriteConflicts}
                                        disabled={isRestoring}
                                        onChange={(event) => setOverwriteConflicts(event.target.checked)}
                                        className="mt-1 h-5 w-5"
                                    />
                                    <span>
                                        <span className="block font-medium">{t.stats.overwriteConflicts}</span>
                                        <span className="block text-sm text-gray-400">{t.stats.overwriteConflictsDesc}</span>
                                    </span>
                                </label>
                            )}

                            {importState.backup.legacy && (
                                <p className="text-sm text-amber-300">{t.stats.legacyPreservesSettings}</p>
                            )}

                            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={isRestoring}
                                    onClick={() => setImportState(null)}
                                >
                                    {t.common.cancel}
                                </Button>
                                <Button
                                    type="button"
                                    disabled={isRestoring}
                                    onClick={() => void restoreData()}
                                    className="gap-2"
                                >
                                    {isRestoring && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {isRestoring ? t.stats.restoring : t.stats.restore}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
