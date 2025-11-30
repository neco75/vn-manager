import { VN, VNDBResponse } from "@/types/vndb";

const API_URL = "https://api.vndb.org/kana/vn";

// Simple cache helper
const getCache = (key: string) => {
    if (typeof window === "undefined") return null;
    const cached = sessionStorage.getItem(key);
    if (!cached) return null;
    try {
        const { data, timestamp } = JSON.parse(cached);
        // Cache for 1 hour
        if (Date.now() - timestamp > 60 * 60 * 1000) {
            sessionStorage.removeItem(key);
            return null;
        }
        return data;
    } catch {
        return null;
    }
};

const setCache = (key: string, data: any) => {
    if (typeof window === "undefined") return;
    try {
        sessionStorage.setItem(key, JSON.stringify({
            data,
            timestamp: Date.now()
        }));
    } catch (e) {
        // Handle quota exceeded
        console.warn("Cache storage full", e);
    }
};

export async function searchVNs(query: string): Promise<VN[]> {
    const cacheKey = `vndb_search_${query}`;
    const cached = getCache(cacheKey);
    if (cached) return cached;

    const response = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            filters: ["search", "=", query],
            fields: "title, released, image.url, description, rating, votecount, length_minutes, tags.name, developers.name",
            sort: "searchrank",
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        console.error(`VNDB API Error: ${response.status} ${response.statusText}`, text);
        throw new Error(`Failed to fetch VNs: ${response.status} ${text}`);
    }

    const data: VNDBResponse<VN> = await response.json();
    setCache(cacheKey, data.results);
    return data.results;
}

export async function getVNById(id: string): Promise<VN | null> {
    const cacheKey = `vndb_vn_${id}`;
    const cached = getCache(cacheKey);
    if (cached) return cached;

    const response = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            filters: ["id", "=", id],
            fields: "title, released, image.url, description, rating, votecount, length_minutes, tags.name, developers.name, screenshots.url, screenshots.thumbnail, screenshots.sexual, extlinks.url, extlinks.label",
        }),
    });

    if (!response.ok) {
        throw new Error("Failed to fetch VN");
    }

    const data: VNDBResponse<VN> = await response.json();
    const result = data.results[0] || null;
    if (result) setCache(cacheKey, result);
    return result;
}
