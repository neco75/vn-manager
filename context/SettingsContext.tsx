"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { scheduleSettingsRestore } from "@/lib/settings-storage.mjs";

interface SettingsContextType {
    backgroundImage: string | null;
    backgroundImageSexual: number | null;
    setBackgroundImage: (url: string | null, sexual?: number | null) => void;
    nsfwBlur: boolean;
    setNsfwBlur: (blur: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
    const [backgroundImageSexual, setBackgroundImageSexual] = useState<number | null>(null);
    const [nsfwBlur, setNsfwBlur] = useState<boolean>(true);

    useEffect(() => {
        return scheduleSettingsRestore(
            localStorage,
            setBackgroundImage,
            setNsfwBlur,
            window.setTimeout,
            window.clearTimeout,
            setBackgroundImageSexual,
        );
    }, []);

    const handleSetBackgroundImage = (url: string | null, sexual: number | null = null) => {
        if (url) {
            localStorage.setItem("vn-manager-bg", url);
            if (typeof sexual === "number" && Number.isFinite(sexual) && sexual >= 0 && sexual <= 2) {
                localStorage.setItem("vn-manager-bg-sexual", String(sexual));
            } else {
                localStorage.removeItem("vn-manager-bg-sexual");
            }
        } else {
            localStorage.removeItem("vn-manager-bg");
            localStorage.removeItem("vn-manager-bg-sexual");
        }
        setBackgroundImage(url);
        setBackgroundImageSexual(url ? sexual : null);
    };

    const handleSetNsfwBlur = (blur: boolean) => {
        localStorage.setItem("vn-manager-nsfw-blur", String(blur));
        setNsfwBlur(blur);
    };

    return (
        <SettingsContext.Provider
            value={{
                backgroundImage,
                backgroundImageSexual,
                setBackgroundImage: handleSetBackgroundImage,
                nsfwBlur,
                setNsfwBlur: handleSetNsfwBlur,
            }}
        >
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error("useSettings must be used within a SettingsProvider");
    }
    return context;
}
