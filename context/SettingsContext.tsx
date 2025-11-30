"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface SettingsContextType {
    backgroundImage: string | null;
    setBackgroundImage: (url: string | null) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const [backgroundImage, setBackgroundImage] = useState<string | null>(null);

    useEffect(() => {
        const stored = localStorage.getItem("vn-manager-bg");
        if (stored) {
            setBackgroundImage(stored);
        }
    }, []);

    const handleSetBackgroundImage = (url: string | null) => {
        if (url) {
            localStorage.setItem("vn-manager-bg", url);
        } else {
            localStorage.removeItem("vn-manager-bg");
        }
        setBackgroundImage(url);
    };

    return (
        <SettingsContext.Provider
            value={{
                backgroundImage,
                setBackgroundImage: handleSetBackgroundImage,
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
