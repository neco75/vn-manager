import { expect, test, type Page } from "@playwright/test";
import type { LibraryItem } from "@/types/library";
import type { VN } from "@/types/vndb";
import fixture from "./fixtures/vndb.json";
import { mockVNDB } from "./helpers";

const DB_NAME = "vn-manager-db";
const DB_VERSION = 3;
const fixtureVN = (fixture.vns as unknown as Record<string, VN>).v1;

function savedItem(): LibraryItem {
    return {
        recordVersion: 2,
        vn: structuredClone(fixtureVN),
        status: "playing",
        ownership: "owned",
        score: 72,
        notes: "Saved private notes",
        review: "Saved review",
        playTime: 750,
        purchaseLocation: "Steam",
        startedOn: "2024-01-02",
        completedOn: "2024-02-03",
        lastPlayedOn: "2024-02-02",
        resumeNote: "Continue at chapter three",
        addedAt: 10,
        updatedAt: 20,
    };
}

async function seedDatabase(page: Page, item: LibraryItem) {
    // Use a same-origin static response before the app loads so IndexedDB is
    // available without triggering the LibraryProvider's first open.
    await page.goto("/robots.txt");
    await page.evaluate(({ dbName, dbVersion, item }) => new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(dbName, dbVersion);
        request.onerror = () => reject(request.error);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains("library")) {
                const store = db.createObjectStore("library", { keyPath: "vn.id" });
                store.createIndex("by-status", "status");
            }
            if (!db.objectStoreNames.contains("purchase_sources")) {
                db.createObjectStore("purchase_sources", { keyPath: "name" });
            }
        };
        request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction(["library", "purchase_sources"], "readwrite");
            transaction.objectStore("library").put(item);
            ["Steam", "DMM", "Package"].forEach((name) => {
                transaction.objectStore("purchase_sources").put({ name });
            });
            transaction.oncomplete = () => {
                db.close();
                resolve();
            };
            transaction.onerror = () => reject(transaction.error);
        };
    }), { dbName: DB_NAME, dbVersion: DB_VERSION, item });
}

async function failInitialOpens(page: Page, failures: number) {
    await page.addInitScript((failureCount) => {
        const testWindow = window as Window & {
            __vnManagerOpenCalls?: number;
            __vnManagerOpenFailures?: number;
            __vnManagerNativeOpen?: IDBFactory["open"];
            __vnManagerUnhandledRejections?: number;
        };
        const nativeOpen = IDBFactory.prototype.open;
        testWindow.__vnManagerNativeOpen = nativeOpen;
        testWindow.__vnManagerOpenCalls = 0;
        testWindow.__vnManagerOpenFailures = failureCount;
        testWindow.__vnManagerUnhandledRejections = 0;
        window.addEventListener("unhandledrejection", () => {
            testWindow.__vnManagerUnhandledRejections = (testWindow.__vnManagerUnhandledRejections ?? 0) + 1;
        });
        IDBFactory.prototype.open = function (name: string, version?: number) {
            if (name === "vn-manager-db") {
                testWindow.__vnManagerOpenCalls = (testWindow.__vnManagerOpenCalls ?? 0) + 1;
                if ((testWindow.__vnManagerOpenFailures ?? 0) > 0) {
                    testWindow.__vnManagerOpenFailures = (testWindow.__vnManagerOpenFailures ?? 1) - 1;
                    return Reflect.apply(nativeOpen, this, [name, 2]);
                }
            }
            return Reflect.apply(nativeOpen, this, [name, version]);
        };
    }, failures);
}

async function openDatabaseNormally(page: Page) {
    return page.evaluate(() => new Promise<boolean>((resolve, reject) => {
        const testWindow = window as Window & { __vnManagerNativeOpen?: IDBFactory["open"] };
        const request = testWindow.__vnManagerNativeOpen?.call(indexedDB, "vn-manager-db", 3);
        if (!request) {
            reject(new Error("The original IndexedDB open method was not retained"));
            return;
        }
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            request.result.close();
            resolve(true);
        };
    }));
}

async function expectSavedFields(page: Page) {
    await expect(page.locator("#detail-notes")).toHaveValue("Saved private notes");
    await expect(page.getByRole("textbox", { name: "感想・レビュー" })).toHaveText("Saved review");
    await expect(page.locator("#detail-score")).toHaveValue("72");
    await expect(page.locator("#detail-started-on")).toHaveValue("2024-01-02");
    await expect(page.locator("#detail-completed-on")).toHaveValue("2024-02-03");
    await expect(page.locator("#detail-last-played-on")).toHaveValue("2024-02-02");
    await expect(page.locator("#detail-resume-note")).toHaveValue("Continue at chapter three");
    await expect(page.locator("#detail-status")).toContainText("プレイ中");
    await expect(page.locator("#detail-ownership")).toContainText("所有済み");
    await expect(page.locator("#detail-purchase-location")).toContainText("Steam");
}

test("reopens IndexedDB after consecutive open failures and restores the saved record", async ({ page }) => {
    await seedDatabase(page, savedItem());
    await failInitialOpens(page, 3);
    await page.goto("/");

    const loadError = page.getByRole("heading", { name: "ライブラリを読み込めませんでした", exact: true });
    const retry = page.getByRole("button", { name: "再読み込み", exact: true });
    await expect(loadError).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as Window & { __vnManagerOpenCalls?: number }).__vnManagerOpenCalls))
        .toBe(1);
    await expect(page.getByRole("heading", { name: "ライブラリが空です", exact: true })).toHaveCount(0);

    await retry.click();
    await expect(loadError).toBeVisible();
    await page.waitForTimeout(0);
    const retryOpenCalls = await page.evaluate(() => (window as Window & { __vnManagerOpenCalls?: number }).__vnManagerOpenCalls);
    const directOpenSucceeded = await openDatabaseNormally(page);

    // A normal v3 open succeeds after the simulated failure. The application retry
    // must make a new open call instead of returning the rejected Promise again.
    expect(directOpenSucceeded).toBe(true);
    expect(retryOpenCalls).toBeGreaterThan(1);
    expect(await page.evaluate(() => (window as Window & { __vnManagerUnhandledRejections?: number }).__vnManagerUnhandledRejections))
        .toBe(0);

    await expect(retry).toBeEnabled();
    await retry.click();
    await expect(loadError).toBeVisible();
    await expect(retry).toBeEnabled();
    await page.waitForTimeout(0);
    expect(await page.evaluate(() => (window as Window & { __vnManagerUnhandledRejections?: number }).__vnManagerUnhandledRejections))
        .toBe(0);

    await retry.click();
    const savedTitle = page.getByRole("link", { name: "Fixture VN One", exact: true }).first();
    await expect(savedTitle).toBeVisible();
    await savedTitle.click();

    await expectSavedFields(page);
});

test("initializes the detail form from saved values after a failed load recovers", async ({ page }) => {
    await seedDatabase(page, savedItem());
    await failInitialOpens(page, 1);
    await mockVNDB(page);
    await page.goto("/vn/v1");

    const loadError = page.getByRole("heading", { name: "ライブラリを読み込めませんでした", exact: true });
    await expect(loadError).toBeVisible();
    await expect(page.getByRole("button", { name: "再読み込み", exact: true })).toBeEnabled();
    await expect(page.getByText("この作品は見つかりませんでした。", { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "再読み込み", exact: true }).click();
    await page.getByTestId("detail-notes-section").locator("summary").click();
    await expect(page.locator("#detail-notes")).toBeVisible();
    await expectSavedFields(page);
});

test("stats and ranking show a database error instead of their empty states", async ({ browser }) => {
    for (const route of ["/stats", "/ranking"]) {
        const context = await browser.newContext();
        try {
            const page = await context.newPage();
            await seedDatabase(page, savedItem());
            await failInitialOpens(page, 2);
            await page.goto(route);

            const loadError = page.getByRole("heading", { name: "ライブラリを読み込めませんでした", exact: true });
            const retry = page.getByRole("button", { name: "再読み込み", exact: true });
            await expect(loadError).toBeVisible();
            await expect(retry).toBeEnabled();
            await expect(page.getByRole("heading", { name: "ランキングデータがありません", exact: true })).toHaveCount(0);
            await expect(page.getByText("まだ記録がありません。", { exact: true })).toHaveCount(0);

            await retry.click();
            await expect(loadError).toBeVisible();
            await page.waitForTimeout(0);
            expect(await page.evaluate(() => (window as Window & { __vnManagerUnhandledRejections?: number }).__vnManagerUnhandledRejections))
                .toBe(0);

            await retry.click();
            if (route === "/stats") {
                await expect(page.getByTestId("stats-share-root")).toBeVisible();
            } else {
                await expect(page.getByRole("link", { name: "Fixture VN One", exact: true }).first()).toBeVisible();
            }
        } finally {
            await context.close();
        }
    }
});
