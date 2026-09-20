"use client";

import { useRef, useState } from "react";
import { SettingsProvider, useSettings } from "@/context/SettingsContext";
import { LanguageProvider, useLanguage } from "@/context/LanguageContext";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Library, Search, Trophy, PieChart, Settings, Globe, Eye, EyeOff, Menu } from "lucide-react";
import { Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { shouldBlurImage } from "@/lib/image-safety";
import { Switch } from "@/components/ui/switch";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

function BackgroundLayer() {
    const { backgroundImage, backgroundImageSexual, nsfwBlur } = useSettings();

    if (!backgroundImage) return null;

    const blurBackground = shouldBlurImage(backgroundImageSexual, nsfwBlur);

    return (
        <div
            className={`fixed inset-0 z-[-1] bg-cover bg-center opacity-30 transition-all duration-1000 ${blurBackground ? "blur-3xl scale-110" : "blur-sm"}`}
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
    const pathname = usePathname();
    const { language, setLanguage, t } = useLanguage();
    const { nsfwBlur, setNsfwBlur } = useSettings();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuButtonRef = useRef<HTMLButtonElement>(null);

    const navItems = [
        { href: "/", icon: <Library className="w-4 h-4" />, label: t.nav.library },
        { href: "/search", icon: <Search className="w-4 h-4" />, label: t.nav.search },
        { href: "/ranking", icon: <Trophy className="w-4 h-4" />, label: t.nav.ranking },
        { href: "/stats", icon: <PieChart className="w-4 h-4" />, label: t.nav.stats },
        { href: "/settings", icon: <Settings className="w-4 h-4" />, label: t.nav.settings },
    ];

    return (
        <>
            <BackgroundLayer />
            <div className="relative z-10 flex min-h-screen min-w-0 flex-col overflow-x-clip">
                <header className="sticky top-0 z-30 w-full border-b border-white/10 bg-background">
                    <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center justify-between gap-3 px-4 sm:px-6 lg:h-16 lg:px-8">
                        <Link href="/" className="flex min-w-0 items-center gap-2 text-xl font-bold tracking-tight group">
                            <span className="text-primary group-hover:text-accent transition-colors duration-300">VN</span>
                            <span className="truncate">Manager</span>
                        </Link>

                        <div className="hidden lg:flex min-w-0 items-center gap-2">
                            <nav className="flex min-w-0 items-center gap-1" aria-label={t.nav.primary}>
                                {navItems.map((item) => (
                                    <NavLink
                                        key={item.href}
                                        {...item}
                                        active={isActivePath(pathname, item.href)}
                                    />
                                ))}
                            </nav>

                            <div className="flex items-center gap-2 rounded-lg border border-white/10 px-2 py-1.5">
                                {nsfwBlur ? (
                                    <EyeOff className="w-4 h-4 shrink-0 text-red-400" aria-hidden="true" />
                                ) : (
                                    <Eye className="w-4 h-4 shrink-0 text-green-400" aria-hidden="true" />
                                )}
                                <label htmlFor="desktop-nsfw-blur" className="text-xs whitespace-nowrap">
                                    {t.settings.nsfwBlur}
                                </label>
                                <Switch
                                    id="desktop-nsfw-blur"
                                    checked={nsfwBlur}
                                    onCheckedChange={setNsfwBlur}
                                    aria-label={t.settings.nsfwBlur}
                                    className="data-[state=checked]:bg-red-500"
                                />
                            </div>

                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setLanguage(language === "ja" ? "en" : "ja")}
                                className="min-h-11 items-center gap-2 px-3 text-gray-400 hover:text-white"
                                aria-label={t.nav.changeLanguage}
                            >
                                <Globe className="w-4 h-4" aria-hidden="true" />
                                {language === "ja" ? "EN" : "JA"}
                            </Button>
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            className="min-h-11 shrink-0 gap-2 lg:hidden"
                            onClick={() => setMenuOpen(true)}
                            ref={menuButtonRef}
                            aria-haspopup="dialog"
                            aria-expanded={menuOpen}
                        >
                            <Menu className="h-5 w-5" aria-hidden="true" />
                            {t.nav.menu}
                        </Button>
                    </div>
                </header>

                <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
                    <DialogContent
                        className="max-h-[calc(100dvh-2rem)] max-w-sm overflow-y-auto bg-card border-white/10"
                        onCloseAutoFocus={(event) => {
                            event.preventDefault();
                            menuButtonRef.current?.focus();
                        }}
                    >
                        <DialogHeader>
                            <DialogTitle>{t.nav.menu}</DialogTitle>
                        </DialogHeader>

                        <nav className="grid gap-1" aria-label={t.nav.primary}>
                            {navItems.map((item) => (
                                <NavLink
                                    key={item.href}
                                    {...item}
                                    active={isActivePath(pathname, item.href)}
                                    onClick={() => setMenuOpen(false)}
                                    mobile
                                />
                            ))}
                        </nav>

                        <div className="border-t border-white/10 pt-4 space-y-4">
                            <div className="flex min-h-11 items-center justify-between gap-4">
                                <div className="flex min-w-0 items-center gap-2">
                                    {nsfwBlur ? (
                                        <EyeOff className="w-5 h-5 shrink-0 text-red-400" aria-hidden="true" />
                                    ) : (
                                        <Eye className="w-5 h-5 shrink-0 text-green-400" aria-hidden="true" />
                                    )}
                                    <label htmlFor="mobile-nsfw-blur" className="text-sm font-medium">
                                        {t.settings.nsfwBlur}
                                    </label>
                                </div>
                                <Switch
                                    id="mobile-nsfw-blur"
                                    checked={nsfwBlur}
                                    onCheckedChange={setNsfwBlur}
                                    aria-label={t.settings.nsfwBlur}
                                    className="data-[state=checked]:bg-red-500"
                                />
                            </div>

                            <Button
                                type="button"
                                variant="outline"
                                className="min-h-11 w-full justify-start gap-3"
                                onClick={() => setLanguage(language === "ja" ? "en" : "ja")}
                            >
                                <Globe className="w-5 h-5" aria-hidden="true" />
                                <span>{t.nav.language}: {language === "ja" ? t.settings.languageJapanese : t.settings.languageEnglish}</span>
                                <span className="ml-auto text-muted-foreground">
                                    {language === "ja" ? "EN" : "JA"}
                                </span>
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                <main className="mx-auto w-full max-w-[1200px] min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
                    {children}
                </main>
                <Toaster theme="dark" position="bottom-right" />
            </div>
        </>
    );
}

function isActivePath(pathname: string, href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
    href,
    icon,
    label,
    active,
    mobile = false,
    onClick,
}: {
    href: string;
    icon: React.ReactNode;
    label: string;
    active: boolean;
    mobile?: boolean;
    onClick?: () => void;
}) {
    return (
        <Link
            href={href}
            onClick={onClick}
            aria-current={active ? "page" : undefined}
            className={
                mobile
                    ? `flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active ? "bg-white/10 text-white" : "text-gray-300 hover:bg-white/5 hover:text-white"}`
                    : `flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active ? "bg-white/10 text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"}`
            }
        >
            {icon}
            <span>{label}</span>
        </Link>
    );
}
