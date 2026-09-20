import { VN, VNDBResponse } from "@/types/vndb";

const API_URL = "https://api.vndb.org/kana/vn";

// Simple cache helper
const getCache = <T>(key: string): T | null => {
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

const setCache = <T>(key: string, data: T) => {
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
    const cacheKey = `vndb_v2_search_${query}`;
    const cached = getCache<VN[]>(cacheKey);
    if (cached) return cached;

    const response = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            filters: ["search", "=", query],
            fields: "title, released, image.url, image.sexual, description, rating, votecount, length_minutes, tags.name, developers.name",
            sort: "searchrank",
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        console.error(`VNDB API Error: ${response.status} ${response.statusText}`, text);
        throw new Error(`Failed to fetch VNs: ${response.status} ${text}`);
    }

    const data: VNDBResponse<VN> = await response.json();
    const vns = data.results.map((vn) => ({ ...vn, releases: vn.releases ?? [] }));

    setCache(cacheKey, vns);
    return vns;
}

export async function getVNById(id: string): Promise<VN | null> {
    const cacheKey = `vndb_v2_vn_${id}`;
    const cached = getCache<VN>(cacheKey);
    if (cached) return cached;

    const response = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            filters: ["id", "=", id],
            fields: "title, released, image.url, image.sexual, description, rating, votecount, length_minutes, tags.name, developers.name, screenshots.url, screenshots.thumbnail, screenshots.sexual, extlinks.url, extlinks.label",
        }),
    });

    if (!response.ok) {
        throw new Error("Failed to fetch VN");
    }

    const data: VNDBResponse<VN> = await response.json();
    const rawResult = data.results[0] || null;
    const result = rawResult ? { ...rawResult, releases: rawResult.releases ?? [] } : null;
    if (result) {
        setCache(cacheKey, result);
    }
    return result;
}

export async function getVNsByIds(ids: string[], onProgress?: (current: number, total: number) => void): Promise<VN[]> {
    if (ids.length === 0) return [];

    const CHUNK_SIZE = 50;
    const allResults: VN[] = [];

    if (onProgress) onProgress(0, ids.length);

    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        // Add a small delay between requests if not the first request
        if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const chunk = ids.slice(i, i + CHUNK_SIZE);
        const filters = chunk.length > 1
            ? ["or", ...chunk.map(id => ["id", "=", id])]
            : ["id", "=", chunk[0]];

        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                filters: filters,
                fields: "id, title, released, image.url, image.sexual, description, rating, votecount, length_minutes, tags.name, developers.name, screenshots.url, screenshots.thumbnail, screenshots.sexual, extlinks.url, extlinks.label",
                results: CHUNK_SIZE,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`VNDB API Error (getVNsByIds chunk ${i}): ${response.status}`, errorText);
            throw new Error(`Failed to fetch VNs by IDs: ${response.status} ${errorText}`);
        }

        const data: VNDBResponse<VN> = await response.json();
        const vns = data.results.map((vn) => ({ ...vn, releases: vn.releases ?? [] }));

        allResults.push(...vns);

        if (onProgress) onProgress(allResults.length, ids.length);
    }

    return allResults;
}
