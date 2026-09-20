import { VN, VNDBResponse } from "@/types/vndb";

const API_URL = "https://api.vndb.org/kana/vn";

export class VNDBRequestError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = "VNDBRequestError";
        this.status = status;
    }
}

export interface VNMetadata {
    id: string;
    title: string;
    description?: string;
    image: { url: string } | null;
}

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

export interface VNSearchPage {
    results: VN[];
    /** 次のページがあるか（VNDBの `more`） */
    more: boolean;
}

const SEARCH_RESULTS_PER_PAGE = 25;

export async function searchVNs(
    query: string,
    options: { page?: number; signal?: AbortSignal } = {},
): Promise<VNSearchPage> {
    const page = Number.isInteger(options.page) && (options.page as number) > 0 ? (options.page as number) : 1;
    // tags.spoiler とページングを扱うため、旧形式のキャッシュを再利用しない。
    // 成功した応答だけをキャッシュし、失敗は空結果として保持しない。
    const cacheKey = `vndb_v4_search_${query}_${page}`;
    const cached = getCache<VNSearchPage>(cacheKey);
    if (cached) return cached;

    const response = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        signal: options.signal,
        body: JSON.stringify({
            filters: ["search", "=", query],
            fields: "title, released, image.url, image.sexual, description, rating, votecount, length_minutes, tags.name, tags.spoiler, developers.name",
            sort: "searchrank",
            results: SEARCH_RESULTS_PER_PAGE,
            page,
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        console.error(`VNDB API Error: ${response.status} ${response.statusText}`, text);
        throw new Error(`Failed to fetch VNs: ${response.status} ${text}`);
    }

    const data: VNDBResponse<VN> = await response.json();
    const searchPage: VNSearchPage = {
        results: data.results.map((vn) => ({ ...vn, releases: vn.releases ?? [] })),
        more: data.more === true,
    };

    setCache(cacheKey, searchPage);
    return searchPage;
}

export async function getVNById(
    id: string,
    options: { signal?: AbortSignal } = {},
): Promise<VN | null> {
    // tags.spoiler を取得するようになったため、旧形式のキャッシュを再利用しない
    const cacheKey = `vndb_v3_vn_${id}`;
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
            fields: "title, released, image.url, image.sexual, description, rating, votecount, length_minutes, tags.name, tags.spoiler, developers.name, screenshots.url, screenshots.thumbnail, screenshots.sexual, extlinks.url, extlinks.label",
        }),
    });

    if (!response.ok) {
        throw new VNDBRequestError(
            `Failed to fetch VN: ${response.status} ${response.statusText}`,
            response.status,
        );
    }

    const data: VNDBResponse<VN> = await response.json();
    const rawResult = data.results[0] || null;
    const result = rawResult ? { ...rawResult, releases: rawResult.releases ?? [] } : null;
    if (result) {
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
                fields: "id, title, released, image.url, image.sexual, description, rating, votecount, length_minutes, tags.name, tags.spoiler, developers.name, screenshots.url, screenshots.thumbnail, screenshots.sexual, extlinks.url, extlinks.label",
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

