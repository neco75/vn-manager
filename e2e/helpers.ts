import type { Page } from "@playwright/test";
import fixture from "./fixtures/vndb.json";
import type { LibraryItem } from "@/types/library";
import type { VN } from "@/types/vndb";

const VNDB_API = "**/api.vndb.org/kana/vn";
const DB_NAME = "vn-manager-db";
const DB_VERSION = 3;
export const FIXTURE_STATUS_URL = `http://127.0.0.1:${process.env.PLAYWRIGHT_FIXTURE_PORT ?? 3101}/__fixture/status`;

type SearchPage = { ids: string[]; more: boolean };

const fixtureVNs = fixture.vns as unknown as Record<string, VN>;
const fixtureSearch = fixture.search as Record<string, Record<string, SearchPage>>;

export async function mockVNDB(
    page: Page,
    options: {
        detailError?: boolean;
        failRetryOnce?: boolean;
        failLoadMore?: boolean;
    } = {},
) {
    let retryFailed = false;
    let loadMoreFailed = false;

    await page.route("**/_next/image**", async (route) => {
        await route.fulfill({
            contentType: "image/png",
            body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
        });
    });

    await page.route("https://t.vndb.org/**", async (route) => {
        await route.fulfill({
            contentType: "image/png",
            body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
        });
    });

    await page.route(VNDB_API, async (route) => {
        const request = route.request();
        const body = request.postDataJSON() as { filters?: unknown[]; page?: number };
        const filters = body.filters;

        if (Array.isArray(filters) && filters[0] === "id") {
            const id = typeof filters[2] === "string" ? filters[2] : "";
            if (options.detailError) {
                await route.fulfill({
                    status: 503,
                    contentType: "application/json",
                    body: JSON.stringify({ error: "fixture detail failure" }),
                });
                return;
            }

            await route.fulfill({
                contentType: "application/json",
                body: JSON.stringify({ results: fixtureVNs[id] ? [fixtureVNs[id]] : [], more: false }),
            });
            return;
        }

        const query = Array.isArray(filters) && typeof filters[2] === "string" ? filters[2] : "";
        const pageNumber = Number(body.page ?? 1);

        if (options.failRetryOnce && query === "retry" && !retryFailed) {
            retryFailed = true;
            await route.fulfill({
                status: 503,
                contentType: "application/json",
                body: JSON.stringify({ error: "fixture retry failure" }),
            });
            return;
        }

        if (options.failLoadMore && query === "load-fail" && pageNumber === 2 && !loadMoreFailed) {
            loadMoreFailed = true;
            await route.fulfill({
                status: 503,
                contentType: "application/json",
                body: JSON.stringify({ error: "fixture load-more failure" }),
            });
            return;
        }

        if ((query === "race-a" || query === "page-race-a") && pageNumber === 1) {
            await new Promise((resolve) => setTimeout(resolve, 900));
        }
        if (query === "page-race-a" && pageNumber === 2) {
            await new Promise((resolve) => setTimeout(resolve, 900));
        }

        const response = fixtureSearch[query]?.[String(pageNumber)] ?? { ids: [], more: false };
        await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
                results: response.ids.map((id) => fixtureVNs[id]),
                more: response.more,
                count: response.ids.length,
            }),
        });
    });

    await page.route("https://api.vndb.org/**", async (route) => {
        if (new URL(route.request().url()).pathname === "/kana/vn") {
            await route.fallback();
            return;
        }
        throw new Error(`Unexpected real VNDB request in E2E: ${route.request().url()}`);
    });
}

export async function holdVNDBIdRequest(page: Page, id: string) {
    let releaseRequest!: () => void;
    let markRequestStarted!: () => void;
    const requestStarted = new Promise<void>((resolve) => {
        markRequestStarted = resolve;
    });
    const requestRelease = new Promise<void>((resolve) => {
        releaseRequest = resolve;
    });

    await page.route(VNDB_API, async (route) => {
        const body = route.request().postDataJSON() as { filters?: unknown[] };
        const filters = body.filters;
        if (Array.isArray(filters) && filters[0] === "id" && filters[2] === id) {
            markRequestStarted();
            await requestRelease;
        }
        await route.fallback();
    });

    return { requestStarted, releaseRequest };
}

export async function failLibraryWrites(page: Page) {
    await page.addInitScript(() => {
        const originalPut = IDBObjectStore.prototype.put;
        const originalAdd = IDBObjectStore.prototype.add;
        IDBObjectStore.prototype.put = function (...args: unknown[]) {
            if (this.name === "library") {
                throw new DOMException("fixture quota exceeded", "QuotaExceededError");
            }
            return Reflect.apply(originalPut, this, args);
        };
        IDBObjectStore.prototype.add = function (...args: unknown[]) {
            if (this.name === "library") {
                throw new DOMException("fixture quota exceeded", "QuotaExceededError");
            }
            return Reflect.apply(originalAdd, this, args);
        };
    });
}

export async function failDetailDraftWrites(page: Page) {
    await page.addInitScript(() => {
        const originalSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key: string, value: string) {
            if (key.startsWith("vn-manager-detail-draft-v1:")) {
                throw new DOMException("fixture quota exceeded", "QuotaExceededError");
            }
            return originalSetItem.call(this, key, value);
        };
    });
}

export async function failBackupRestoreWrites(page: Page) {
    await page.addInitScript(() => {
        const testWindow = window as Window & { __vnManagerFailBackupRestore?: boolean };
        testWindow.__vnManagerFailBackupRestore = false;
        const originalClear = IDBObjectStore.prototype.clear;
        IDBObjectStore.prototype.clear = function () {
            if (this.name === "purchase_sources" && testWindow.__vnManagerFailBackupRestore) {
                testWindow.__vnManagerFailBackupRestore = false;
                this.transaction.abort();
            }
            return Reflect.apply(originalClear, this, []);
        };
    });
}

export async function armBackupRestoreFailure(page: Page) {
    await page.evaluate(() => {
        (window as Window & { __vnManagerFailBackupRestore?: boolean }).__vnManagerFailBackupRestore = true;
    });
}

export async function seedLibraryItem(
    page: Page,
    id = "v1",
    overrides: Partial<LibraryItem> = {},
) {
    const vn = structuredClone(fixtureVNs[id]);
    const item: LibraryItem = {
        recordVersion: 2,
        vn,
        status: "plan_to_play",
        ownership: "unknown",
        score: null,
        notes: "",
        addedAt: 1,
        updatedAt: 1,
        ...overrides,
    };

    await seedLibraryItems(page, [item]);
}

export async function seedLibraryItems(page: Page, items: LibraryItem[]) {
    await page.evaluate(
        ({ items, dbName, dbVersion }) => new Promise<void>((resolve, reject) => {
            const request = indexedDB.open(dbName, dbVersion);
            request.onerror = () => reject(request.error);
            request.onupgradeneeded = () => {
                const database = request.result;
                if (!database.objectStoreNames.contains("library")) {
                    const library = database.createObjectStore("library", { keyPath: "vn.id" });
                    library.createIndex("by-status", "status");
                }
                if (!database.objectStoreNames.contains("purchase_sources")) {
                    database.createObjectStore("purchase_sources", { keyPath: "name" });
                }
            };
            request.onsuccess = () => {
                const database = request.result;
                const transaction = database.transaction("library", "readwrite");
                const store = transaction.objectStore("library");
                items.forEach((item) => store.put(item));
                transaction.oncomplete = () => {
                    database.close();
                    resolve();
                };
                transaction.onerror = () => reject(transaction.error);
            };
        }),
        { items, dbName: DB_NAME, dbVersion: DB_VERSION },
    );
}

export async function readLibraryIds(page: Page) {
    return page.evaluate(({ dbName, dbVersion }) => new Promise<string[]>((resolve, reject) => {
        const request = indexedDB.open(dbName, dbVersion);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const database = request.result;
            const transaction = database.transaction("library", "readonly");
            const getAllRequest = transaction.objectStore("library").getAllKeys();
            getAllRequest.onsuccess = () => {
                database.close();
                resolve(getAllRequest.result as string[]);
            };
            getAllRequest.onerror = () => reject(getAllRequest.error);
        };
    }), { dbName: DB_NAME, dbVersion: DB_VERSION });
}

export async function readLibraryItem(page: Page, id: string) {
    return page.evaluate(({ dbName, dbVersion, id }) => new Promise<LibraryItem | undefined>((resolve, reject) => {
        const request = indexedDB.open(dbName, dbVersion);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const database = request.result;
            const transaction = database.transaction("library", "readonly");
            const getRequest = transaction.objectStore("library").get(id);
            getRequest.onsuccess = () => {
                database.close();
                resolve(getRequest.result as LibraryItem | undefined);
            };
            getRequest.onerror = () => reject(getRequest.error);
        };
    }), { dbName: DB_NAME, dbVersion: DB_VERSION, id });
}

export async function seedPurchaseSources(page: Page, names: string[]) {
    await page.evaluate(({ dbName, dbVersion, names }) => new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(dbName, dbVersion);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const database = request.result;
            const transaction = database.transaction("purchase_sources", "readwrite");
            const store = transaction.objectStore("purchase_sources");
            for (const name of names) store.put({ name });
            transaction.oncomplete = () => {
                database.close();
                resolve();
            };
            transaction.onerror = () => reject(transaction.error);
        };
    }), { dbName: DB_NAME, dbVersion: DB_VERSION, names });
}

export async function readPurchaseSourceNames(page: Page) {
    return page.evaluate(({ dbName, dbVersion }) => new Promise<string[]>((resolve, reject) => {
        const request = indexedDB.open(dbName, dbVersion);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const database = request.result;
            const transaction = database.transaction("purchase_sources", "readonly");
            const getAllRequest = transaction.objectStore("purchase_sources").getAllKeys();
            getAllRequest.onsuccess = () => {
                database.close();
                resolve((getAllRequest.result as string[]).sort());
            };
            getAllRequest.onerror = () => reject(getAllRequest.error);
        };
    }), { dbName: DB_NAME, dbVersion: DB_VERSION });
}
