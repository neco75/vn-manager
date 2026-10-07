import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import fixture from "./fixtures/vndb.json";
import { mockVNDB, seedLibraryItems } from "./helpers";
import type { LibraryItem } from "@/types/library";
import type { VN } from "@/types/vndb";

const fixtureVNs = fixture.vns as unknown as Record<string, VN>;
const longJapaneseTitle = "日本語の長いタイトル 続編 ファンディスク 追加ルート版 複数エンド収録";
const mobileWidths = [320, 390, 768] as const;
const desktopWidths = [1024, 1440] as const;

function makeItem(sourceId: string, id: string, score: number | null, addedAt: number): LibraryItem {
    const vn = structuredClone(fixtureVNs[sourceId]);
    vn.id = id;
    if (id === "v4") {
        vn.image = null;
        vn.titles = [{ lang: "ja", title: longJapaneseTitle, latin: null }];
    }
    if (id === "unrated-vn") {
        vn.title = "Unrated fixture title";
    }

    return {
        recordVersion: 2,
        vn,
        status: "completed",
        ownership: "unknown",
        score,
        notes: "",
        addedAt,
        updatedAt: addedAt,
    };
}

async function createRankingPage(browser: Browser, width = 390) {
    const context = await browser.newContext({ viewport: { width, height: 844 } });
    const page = await context.newPage();
    await page.addInitScript(() => {
        localStorage.setItem("vn-manager-nsfw-blur", "true");
        localStorage.setItem("vn-manager-lang", "ja");
    });
    await mockVNDB(page);
    return { context, page };
}

async function captureRanking(page: Page, name: string) {
    const screenshotPath = join(process.cwd(), "e2e", "screenshots", name);
    await mkdir(dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, animations: "disabled" });
}

test.describe("V2-10 ranking", () => {
    test("distinguishes initial IndexedDB loading from the no-rated state", async ({ browser }) => {
        const { context, page } = await createRankingPage(browser);
        try {
            await page.addInitScript(() => {
                const originalAddEventListener = IDBRequest.prototype.addEventListener;
                let delayed = false;
                IDBRequest.prototype.addEventListener = function (
                    type: string,
                    listener: EventListenerOrEventListenerObject | null,
                    options?: boolean | AddEventListenerOptions,
                ) {
                    if (type === "success" && listener && !delayed) {
                        delayed = true;
                        const delayedListener: EventListener = (function (this: IDBRequest, event: Event) {
                            window.setTimeout(() => {
                                if (typeof listener === "function") listener.call(this, event);
                                else listener.handleEvent(event);
                            }, 700);
                        }).bind(this);
                        return originalAddEventListener.call(this, type, delayedListener, options);
                    }
                    return originalAddEventListener.call(this, type, listener as EventListenerOrEventListenerObject, options);
                };
            });

            await page.goto("/ranking", { waitUntil: "commit" });
            await expect(page.getByRole("status")).toContainText("読み込み中");
            await expect(page.getByTestId("ranking-rated-count")).toHaveCount(0);
            await expect(page.getByRole("heading", { name: "評価済みの作品がありません" })).not.toBeVisible();
            await expect(page.getByRole("status")).toHaveCount(0);
            await expect(page.getByTestId("ranking-rated-count")).toHaveText("評価済み 0件");
            await expect(page.getByRole("heading", { name: "評価済みの作品がありません" })).toBeVisible();
        } finally {
            await context.close();
        }
    });

    test("shows an IndexedDB error and retries into the loaded ranking", async ({ browser }) => {
        const { context, page } = await createRankingPage(browser);
        try {
            await page.addInitScript(() => {
                const originalTransaction = IDBDatabase.prototype.transaction;
                let failed = false;
                IDBDatabase.prototype.transaction = function (this: IDBDatabase, ...args: Parameters<IDBDatabase["transaction"]>) {
                    const names = typeof args[0] === "string" ? [args[0]] : Array.from(args[0]);
                    if (!failed && names.includes("library")) {
                        failed = true;
                        throw new DOMException("Fixture ranking read failure", "InvalidStateError");
                    }
                    return Reflect.apply(originalTransaction, this, args);
                } as typeof IDBDatabase.prototype.transaction;
            });

            await page.goto("/ranking");
            const error = page.getByRole("alert");
            await expect(error.getByRole("heading", { name: "ライブラリを読み込めませんでした" })).toBeVisible();
            await expect(error.getByRole("button", { name: "再読み込み", exact: true })).toBeVisible();
            await expect(page.getByRole("heading", { name: "評価済みの作品がありません" })).not.toBeVisible();

            await seedLibraryItems(page, [makeItem("v1", "v1", 80, 1)]);
            await error.getByRole("button", { name: "再読み込み", exact: true }).click();
            await expect(page.getByRole("link", { name: "Fixture VN One", exact: true })).toBeVisible();
            await expect(page.getByTestId("ranking-rated-count")).toHaveText("評価済み 1件");
            await expect(page.getByRole("heading", { name: "ライブラリを読み込めませんでした" })).toHaveCount(0);
        } finally {
            await context.close();
        }
    });

    test("shows a distinct no-rated state for a library containing only unrated titles", async ({ browser }) => {
        const { context, page } = await createRankingPage(browser);
        try {
            await page.goto("/ranking");
            await seedLibraryItems(page, [makeItem("v1", "v1", null, 1)]);
            await page.reload();

            await expect(page.getByTestId("ranking-rated-count")).toHaveText("評価済み 0件");
            await expect(page.getByRole("heading", { name: "評価済みの作品がありません" })).toBeVisible();
            await expect(page.getByTestId("ranking-row")).toHaveCount(0);
        } finally {
            await context.close();
        }
    });

    test("keeps competition ranks, zero, image safety, full names, and 320px row targets", async ({ browser }) => {
        const { context, page } = await createRankingPage(browser, 320);
        try {
            await page.goto("/ranking");
            await seedLibraryItems(page, [
                makeItem("v1", "v1", 100, 1),
                makeItem("v2", "v2", 100, 2),
                makeItem("v3", "v3", 100, 3),
                makeItem("v4", "v4", 0, 4),
                makeItem("v1", "unrated-vn", null, 0),
            ]);
            await page.reload();

            const rows = page.getByTestId("ranking-row");
            await expect(rows).toHaveCount(4);
            await expect(page.getByTestId("ranking-rated-count")).toHaveText("評価済み 4件");
            for (const id of ["v1", "v2", "v3"]) {
                await expect(page.locator(`a[href="/vn/${id}"]`).getByTestId("ranking-rank")).toHaveText("#1");
            }
            const zeroRow = page.locator('a[href="/vn/v4"]');
            await expect(zeroRow.getByTestId("ranking-rank")).toHaveText("#4");
            await expect(zeroRow.getByTestId("ranking-score")).toHaveText("0");
            await expect(page.locator('a[href="/vn/unrated-vn"]')).toHaveCount(0);

            const noImageRow = page.getByRole("link", { name: longJapaneseTitle, exact: true });
            await expect(noImageRow).toHaveAttribute("aria-label", longJapaneseTitle);
            await expect(noImageRow.getByTestId("ranking-title")).toHaveText(longJapaneseTitle);
            await expect(noImageRow.locator("img")).toHaveCount(0);
            await expect(noImageRow.getByTestId("ranking-rank")).toHaveText("#4");

            const blurredRow = page.getByRole("link", { name: "Fixture VN Three", exact: true });
            await expect(blurredRow).toHaveAttribute("aria-label", "Fixture VN Three");
            await expect(blurredRow.locator("img")).toHaveClass(/blur-md/);
            await expect(blurredRow.getByText("画像をぼかしています", { exact: true })).toBeVisible();

            for (const width of [...mobileWidths, ...desktopWidths]) {
                await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
                const metrics = await noImageRow.evaluate((row) => {
                    const box = (selector: string) => {
                        const element = row.querySelector(selector);
                        if (!element) throw new Error(`Missing ${selector}`);
                        const { x, y, width: w, height, right, bottom } = element.getBoundingClientRect();
                        return { x, y, width: w, height, right, bottom };
                    };
                    const rowBox = row.getBoundingClientRect();
                    return {
                        rowHeight: rowBox.height,
                        rank: box('[data-testid="ranking-rank"]'),
                        cover: box("div.relative"),
                        title: box('[data-testid="ranking-title"]'),
                        score: box('[data-testid="ranking-score"]'),
                    };
                });
                expect(metrics.rowHeight).toBeGreaterThanOrEqual(44);
                expect(metrics.rank.right).toBeLessThanOrEqual(metrics.cover.x + 1);
                expect(metrics.cover.right).toBeLessThanOrEqual(metrics.title.x + 1);
                expect(metrics.title.width).toBeGreaterThanOrEqual(80);
                const separated =
                    metrics.title.right <= metrics.score.x ||
                    metrics.score.right <= metrics.title.x ||
                    metrics.title.bottom <= metrics.score.y ||
                    metrics.score.bottom <= metrics.title.y;
                expect(separated).toBe(true);
            }

            await page.setViewportSize({ width: 1440, height: 1000 });
            await captureRanking(page, "v2-10-ranking-1440x1000.png");
            await page.setViewportSize({ width: 390, height: 844 });
            await captureRanking(page, "v2-10-ranking-390x844.png");
        } finally {
            await context.close();
        }
    });
});
