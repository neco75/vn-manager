"use client";

import Link from "next/link";
import { Database, Globe, ImageOff, Info, Languages, ShoppingBag } from "lucide-react";
import { BackupManager } from "@/components/BackupManager";
import { PurchaseLocationSelector } from "@/components/PurchaseLocationSelector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/context/LanguageContext";
import { useSettings } from "@/context/SettingsContext";

export default function SettingsPage() {
    const { language, setLanguage, t } = useLanguage();
    const { backgroundImage, nsfwBlur, setBackgroundImage, setNsfwBlur } = useSettings();

    return (
        <div className="mx-auto max-w-4xl space-y-8 pb-20">
            <header className="space-y-2">
                <h1 className="text-3xl font-bold">{t.settings.title}</h1>
                <p className="text-muted-foreground">{t.settings.dataAndBackupDescription}</p>
            </header>

            <section id="backup" aria-labelledby="settings-data-title" className="space-y-3">
                <div className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-primary" aria-hidden="true" />
                    <h2 id="settings-data-title" className="text-xl font-semibold">{t.settings.dataAndBackup}</h2>
                </div>
                <BackupManager />
            </section>

            <section aria-labelledby="settings-display-title" className="space-y-3">
                <div className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-primary" aria-hidden="true" />
                    <h2 id="settings-display-title" className="text-xl font-semibold">{t.settings.displayAndLanguage}</h2>
                </div>
                <Card className="border-white/10">
                    <CardHeader>
                        <CardTitle>{t.settings.displayAndLanguage}</CardTitle>
                        <p className="text-sm text-muted-foreground">{t.settings.displayAndLanguageDescription}</p>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <Languages className="h-4 w-4" aria-hidden="true" />
                                {t.settings.language}
                            </div>
                            <div className="grid grid-cols-2 gap-2" role="group" aria-label={t.settings.language}>
                                <Button
                                    type="button"
                                    variant={language === "ja" ? "default" : "outline"}
                                    aria-pressed={language === "ja"}
                                    onClick={() => setLanguage("ja")}
                                    className="min-h-11"
                                >
                                    {t.settings.languageJapanese}
                                </Button>
                                <Button
                                    type="button"
                                    variant={language === "en" ? "default" : "outline"}
                                    aria-pressed={language === "en"}
                                    onClick={() => setLanguage("en")}
                                    className="min-h-11"
                                >
                                    {t.settings.languageEnglish}
                                </Button>
                            </div>
                        </div>

                        <div className="flex min-h-11 items-center justify-between gap-4">
                            <div className="space-y-1">
                                <label htmlFor="settings-nsfw-blur" className="text-sm font-medium">
                                    {t.settings.nsfwBlur}
                                </label>
                                <p className="text-xs text-muted-foreground">{t.settings.nsfwBlurDescription}</p>
                            </div>
                            <Switch
                                id="settings-nsfw-blur"
                                checked={nsfwBlur}
                                onCheckedChange={setNsfwBlur}
                                aria-label={t.settings.nsfwBlur}
                                className="data-[state=checked]:bg-red-500"
                            />
                        </div>

                        <div className="space-y-3 border-t border-white/10 pt-5">
                            <div className="flex items-center gap-2 text-sm font-medium">
                                <ImageOff className="h-4 w-4" aria-hidden="true" />
                                {t.settings.background}
                            </div>
                            <p className="text-sm text-muted-foreground">{t.settings.backgroundDescription}</p>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm text-muted-foreground" role="status">
                                    {backgroundImage ? t.settings.backgroundSet : t.settings.backgroundNotSet}
                                </p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={!backgroundImage}
                                    onClick={() => setBackgroundImage(null)}
                                    className="min-h-11 gap-2"
                                >
                                    <ImageOff className="h-4 w-4" aria-hidden="true" />
                                    {t.settings.removeBackground}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </section>

            <section aria-labelledby="settings-purchase-title" className="space-y-3">
                <div className="flex items-center gap-2">
                    <ShoppingBag className="h-5 w-5 text-primary" aria-hidden="true" />
                    <h2 id="settings-purchase-title" className="text-xl font-semibold">{t.settings.purchaseLocations}</h2>
                </div>
                <Card className="border-white/10">
                    <CardHeader>
                        <CardTitle>{t.settings.purchaseLocations}</CardTitle>
                        <p className="text-sm text-muted-foreground">{t.settings.purchaseLocationsDescription}</p>
                    </CardHeader>
                    <CardContent>
                        <PurchaseLocationSelector
                            id="settings-purchase-locations"
                            managementOnly
                            onChange={() => undefined}
                        />
                    </CardContent>
                </Card>
            </section>

            <section id="about" aria-labelledby="settings-about-title" className="space-y-3">
                <div className="flex items-center gap-2">
                    <Info className="h-5 w-5 text-primary" aria-hidden="true" />
                    <h2 id="settings-about-title" className="text-xl font-semibold">{t.settings.aboutSection}</h2>
                </div>
                <Card className="border-white/10">
                    <CardContent className="space-y-4 pt-6">
                        <p className="text-sm leading-6 text-muted-foreground">{t.settings.aboutDescription}</p>
                        <p className="text-sm leading-6 text-muted-foreground">{t.about.privacy_desc}</p>
                        <Button asChild variant="outline" className="min-h-11">
                            <Link href="/about">{t.settings.openAbout}</Link>
                        </Button>
                    </CardContent>
                </Card>
            </section>
        </div>
    );
}
