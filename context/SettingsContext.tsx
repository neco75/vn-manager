"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { scheduleSettingsRestore } from "@/lib/settings-storage.mjs";

interface SettingsContextType {
    backgroundImage: string | null;
    setBackgroundImage: (url: string | null) => void;
    nsfwBlur: boolean;
    setNsfwBlur: (blur: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
    const [nsfwBlur, setNsfwBlur] = useState<boolean>(true);

    useEffect(() => {
        return scheduleSettingsRestore(
            localStorage,
            setBackgroundImage,
            setNsfwBlur,
            window.setTimeout,
            window.clearTimeout,
        );
    }, []);

    const handleSetBackgroundImage = (url: string | null) => {
        if (url) {
            localStorage.setItem("vn-manager-bg", url);
        } else {
            localStorage.removeItem("vn-manager-bg");
        }
        setBackgroundImage(url);
    };

    const handleSetNsfwBlur = (blur: boolean) => {
        localStorage.setItem("vn-manager-nsfw-blur", String(blur));
        setNsfwBlur(blur);
    };

    return (
        <SettingsContext.Provider
            value={{
                backgroundImage,
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
