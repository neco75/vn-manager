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
    const cacheKey = `vndb_v2_search_${query}`;
    const cached = getCache(cacheKey);
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
    const vns = data.results;
    const releases = await getReleasesByVnIds(vns.map((v: VN) => v.id));
    vns.forEach((vn: VN) => {
        vn.releases = releases.filter(r => r.vns?.some((v: any) => v.id === vn.id));
    });

    setCache(cacheKey, vns);
    return vns;
}

export async function getVNById(id: string): Promise<VN | null> {
    const cacheKey = `vndb_v2_vn_${id}`;
    const cached = getCache(cacheKey);
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
    const result = data.results[0] || null;
    if (result) {
        const releases = await getReleasesByVnIds([result.id]);
        result.releases = releases;
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
        const vns = data.results;

        // Fetch releases for this chunk
        const releases = await getReleasesByVnIds(vns.map((v: VN) => v.id));
        vns.forEach((vn: VN) => {
            vn.releases = releases.filter(r => r.vns?.some((v: any) => v.id === vn.id));
        });

        allResults.push(...vns);

        if (onProgress) onProgress(allResults.length, ids.length);
    }

    return allResults;
}

async function getReleasesByVnIds(ids: string[]): Promise<any[]> {
    if (ids.length === 0) return [];

    const CHUNK_SIZE = 10;
    const allResults: any[] = [];

    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        // Add a delay between chunks to avoid rate limiting (0.5r/sec is safe)
        if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const chunk = ids.slice(i, i + CHUNK_SIZE);
        const vnFilter = chunk.length > 1
            ? ["or", ...chunk.map(id => ["id", "=", id])]
            : ["id", "=", chunk[0]];

        const response = await fetch("https://api.vndb.org/kana/release", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                filters: ["vn", "=", vnFilter],
                fields: "vns.id, minage",
                results: 100, // Max per page
            }),
        });

        if (!response.ok) {
            const text = await response.text();
            console.error(`VNDB Release API Error (chunk starting at ${i}):`, text);
            continue;
        }

        const data = await response.json();
        allResults.push(...data.results);
    }

    return allResults;
}
