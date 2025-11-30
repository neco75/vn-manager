"use client";

import { SettingsProvider, useSettings } from "@/context/SettingsContext";
import { LanguageProvider, useLanguage } from "@/context/LanguageContext";
import Link from "next/link";
import { Library, Search, Trophy, PieChart, HelpCircle, Globe } from "lucide-react";
import { Toaster } from "sonner";
import { Button } from "@/components/ui/button";

function BackgroundLayer() {
    const { backgroundImage } = useSettings();

    if (!backgroundImage) return null;

    return (
        <div
            className="fixed inset-0 z-[-1] bg-cover bg-center opacity-30 blur-sm transition-all duration-1000"
            style={{ backgroundImage: `url(${backgroundImage})` }}
        />
    );
}

export function ClientLayout({ children }: { children: React.ReactNode }) {
    return (
        <SettingsProvider>
            <LanguageProvider>
                <ClientLayoutContent>{children}</ClientLayoutContent>
            </LanguageProvider>
        </SettingsProvider>
    );
}

function ClientLayoutContent({ children }: { children: React.ReactNode }) {
    const { language, setLanguage, t } = useLanguage();

    return (
        <>
            <BackgroundLayer />
            <div className="relative z-10 flex flex-col min-h-screen">
                <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-black/50 backdrop-blur-xl">
                    <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                        <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight group">
                            <span className="text-primary group-hover:text-accent transition-colors duration-300">VN</span>Manager
                        </Link>

                        <div className="flex items-center gap-4">
                            <nav className="flex items-center gap-1 sm:gap-6">
                                <NavLink href="/" icon={<Library className="w-4 h-4" />} label={t.nav.library} />
                                <NavLink href="/search" icon={<Search className="w-4 h-4" />} label={t.nav.search} />
                                <NavLink href="/ranking" icon={<Trophy className="w-4 h-4" />} label={t.nav.ranking} />
                                <NavLink href="/stats" icon={<PieChart className="w-4 h-4" />} label={t.nav.stats} />
                                <NavLink href="/about" icon={<HelpCircle className="w-4 h-4" />} label={t.nav.about} />
                            </nav>

                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setLanguage(language === "ja" ? "en" : "ja")}
                                className="hidden sm:flex items-center gap-2 text-gray-400 hover:text-white"
                            >
                                <Globe className="w-4 h-4" />
                                {language === "ja" ? "EN" : "JA"}
                            </Button>
                        </div>
                    </div>
                </header>
                <main className="flex-1 container mx-auto px-4 py-8">
                    {children}
                </main>
                <Toaster theme="dark" position="bottom-right" />
            </div>
        </>
    );
}

function NavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
    return (
        <Link
            href={href}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-all"
        >
            {icon}
            <span className="hidden sm:inline">{label}</span>
        </Link>
    );
}
