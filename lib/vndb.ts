import { VN, VNDBResponse, VNRelease } from "@/types/vndb";

const API_URL = "https://api.vndb.org/kana/vn";

export class VNDBRequestError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = "VNDBRequestError";
        this.status = status;
    }
}

export type VNMetadata = Pick<VN, "id" | "title" | "description" | "image">;

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
    const vns = data.results;
    const releases = await getReleasesByVnIds(vns.map((v: VN) => v.id));
    vns.forEach((vn: VN) => {
        vn.releases = releases.filter(r => r.vns?.some(v => v.id === vn.id));
    });

    setCache(cacheKey, vns);
    return vns;
}

export async function getVNById(
    id: string,
    options: { signal?: AbortSignal } = {},
): Promise<VN | null> {
    const cacheKey = `vndb_v2_vn_${id}`;
    const cached = getCache<VN>(cacheKey);
    if (cached) return cached;

    const response = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        signal: options.signal,
        body: JSON.stringify({
            filters: ["id", "=", id],
            fields: "title, released, image.url, image.sexual, description, rating, votecount, length_minutes, tags.name, developers.name, screenshots.url, screenshots.thumbnail, screenshots.sexual, extlinks.url, extlinks.label",
        }),
    });

    if (!response.ok) {
        throw new VNDBRequestError(
            `Failed to fetch VN: ${response.status} ${response.statusText}`,
            response.status,
        );
    }

    const data: VNDBResponse<VN> = await response.json();
    const result = data.results[0] || null;
    if (result) {
        const releases = await getReleasesByVnIds([result.id], options.signal);
        result.releases = releases;
        setCache(cacheKey, result);
    }
    return result;
}

export async function getVNMetadataById(
    id: string,
    options: { signal?: AbortSignal } = {},
): Promise<VNMetadata | null> {
    const response = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        signal: options.signal,
        body: JSON.stringify({
            filters: ["id", "=", id],
            fields: "title, description, image.url",
        }),
    });

    if (!response.ok) {
        throw new VNDBRequestError(
            `Failed to fetch VN metadata: ${response.status} ${response.statusText}`,
            response.status,
        );
    }

    const data: VNDBResponse<VNMetadata> = await response.json();
    return data.results[0] || null;
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
            vn.releases = releases.filter(r => r.vns?.some(v => v.id === vn.id));
        });

        allResults.push(...vns);

        if (onProgress) onProgress(allResults.length, ids.length);
    }

    return allResults;
}

async function getReleasesByVnIds(ids: string[], signal?: AbortSignal): Promise<VNRelease[]> {
    if (ids.length === 0) return [];

    const CHUNK_SIZE = 10;
    const allResults: VNRelease[] = [];

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
            signal,
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

        const data: VNDBResponse<VNRelease> = await response.json();
        allResults.push(...data.results);
    }

    return allResults;
}
