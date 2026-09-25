import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import type { LibraryItem } from "@/types/library";
import type { VN } from "@/types/vndb";
import fixture from "./fixtures/vndb.json";
import { mockVNDB, seedLibraryItems } from "./helpers";

const fixtureVNs = fixture.vns as unknown as Record<string, VN>;
const japaneseTitle = "日本語の長いタイトル 続編 ファンディスクと追加ルートを含む読みやすさ確認用の長い作品名";
const englishTitle = "English Sequel Fan Disc Title with Additional Routes and a Long Name for Readability Checks";
const longEnglishTag = "A very long English genre tag that must wrap without hiding the title or score";
const longJapaneseTag = "非常に長い日本語のジャンルタグを折り返して作品名と評価を読めるか確認します";
const hiddenSpoilerTag = "Hidden fixture spoiler tag";
const responsiveWidths = [320, 390, 768, 1280] as const;
const titleMinimumWidths: Record<(typeof responsiveWidths)[number], number> = {
    320: 120,
    390: 150,
    768: 300,
    1280: 280,
};

function makeLongTitleVN(id: string): VN {
    const vn = structuredClone(fixtureVNs.v4);
    return {
        ...vn,
        id,
        titles: [
            { lang: "ja", title: japaneseTitle, latin: "Japanese long sequel and fan disc" },
            { lang: "en", title: englishTitle, latin: null },
        ],
    };
}

function makeLibraryItem(vn: VN, score: number, addedAt: number): LibraryItem {
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

function makeRankingItems(): LibraryItem[] {
    const topVN = makeLongTitleVN("rank-fixture-000");
    const tiedItems = Array.from({ length: 98 }, (_, index) => {
        const vn = structuredClone(fixtureVNs.v1);
        vn.id = `rank-fixture-${String(index + 1).padStart(3, "0")}`;
        vn.title = `Fixture rank filler ${String(index + 1).padStart(3, "0")}`;
        return makeLibraryItem(vn, 100, index + 1);
    });

    const targetVN = makeLongTitleVN("v4");
    targetVN.tags = [
        { id: "issue52-long-en", name: longEnglishTag, category: "cont", spoiler: 0 },
        { id: "issue52-long-ja", name: longJapaneseTag, category: "cont", spoiler: 0 },
        { id: "issue52-hidden", name: hiddenSpoilerTag, category: "cont", spoiler: 2 },
    ];

    return [
        makeLibraryItem(topVN, 100, 0),
        ...tiedItems,
        makeLibraryItem(targetVN, 0, 100),
    ];
}

function makeImageLessShelfItem(): LibraryItem {
    const vn = makeLongTitleVN("v4");
    vn.image = null;
    return makeLibraryItem(vn, 0, 1);
}

async function createFixturePage(
    browser: Browser,
    width: number,
    options: { touch?: boolean } = {},
): Promise<{ context: Awaited<ReturnType<Browser["newContext"]>>; page: Page }> {
    const context = await browser.newContext({
        viewport: { width, height: 900 },
        hasTouch: options.touch ?? false,
        isMobile: options.touch ?? false,
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
        localStorage.setItem("vn-manager-nsfw-blur", "true");
    });
    await mockVNDB(page);
    await page.goto("/");
    return { context, page };
}

async function expectRenderedTitle(title: Locator, expectedText: string, minWidth: number) {
    await expect(title).toHaveText(expectedText);
    const metrics = await title.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(element);
        const textRects = Array.from(range.getClientRects()).filter((textRect) => textRect.width > 0 && textRect.height > 0);
        return {
            width: rect.width,
            height: rect.height,
            clientWidth: element.clientWidth,
            clientHeight: element.clientHeight,
            scrollWidth: element.scrollWidth,
            scrollHeight: element.scrollHeight,
            renderedTextRects: textRects.length,
        };
    });

    expect(metrics.width).toBeGreaterThanOrEqual(minWidth);
    expect(metrics.height).toBeGreaterThan(0);
    expect(metrics.renderedTextRects).toBeGreaterThan(0);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
    expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight + 1);
}

async function captureViewport(page: Page, name: string) {
    const path = join(process.cwd(), "e2e", "screenshots", name);
    await mkdir(dirname(path), { recursive: true });
    await page.mouse.move((await page.evaluate(() => window.innerWidth)) - 2, 898);
    await page.screenshot({ path, animations: "disabled" });
}

async function createShelfPage(browser: Browser, width: number, touch = false) {
    const { context, page } = await createFixturePage(browser, width, { touch });
    await seedLibraryItems(page, [makeImageLessShelfItem()]);
    await page.reload();
    await page.goto("/?view=shelf");
    return { context, page };
}

async function expectShelfTitle(page: Page, minWidth: number) {
    const titleLink = page.getByTestId("shelf-title-link");
    await expect(titleLink).toHaveAttribute("href", "/vn/v4?from=%2F%3Fview%3Dshelf");
    await expectRenderedTitle(titleLink, japaneseTitle, minWidth);
    await expect(page.getByText("画像なし", { exact: true })).toBeVisible();
    await expect(page.getByText("画像をぼかしています", { exact: true })).not.toBeAttached();
    await expect(page.locator("img")).toHaveCount(0);
    return titleLink;
}

async function expectReturnedToShelf(page: Page) {
    await expect(page).toHaveURL(/\/vn\/v4\?from=%2F%3Fview%3Dshelf$/);
    await expect(page.getByRole("link", { name: "戻る", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "戻る", exact: true }).click();
    await expect(page).toHaveURL(/\/?view=shelf$/);
    await expect(page.getByTestId("shelf-title-link")).toHaveText(japaneseTitle);
}

test.describe("ranking and shelf responsive titles", () => {
    test("keeps Japanese and English ranking titles readable with narrow metadata at every roadmap width", async ({ browser }) => {
        for (const width of responsiveWidths) {
            const { context, page } = await createFixturePage(browser, width);
            try {
                await seedLibraryItems(page, makeRankingItems());
                await page.reload();
                await page.goto("/ranking");

                const topRow = page.locator('a[href="/vn/rank-fixture-000"]');
                const targetRow = page.locator('a[href="/vn/v4"]');
                await expect(topRow).toContainText("#1");
                await expect(topRow.getByTestId("ranking-score")).toHaveText("100");
                await expectRenderedTitle(topRow.getByTestId("ranking-title"), japaneseTitle, titleMinimumWidths[width]);

                await expect(targetRow).toContainText("#100");
                await expect(targetRow.getByTestId("ranking-score")).toHaveText("0");
                await expect(targetRow).toContainText("クリア済み");
                await expect(targetRow.getByText(longEnglishTag, { exact: true })).toBeAttached();
                await expect(targetRow.getByText(longJapaneseTag, { exact: true })).toBeAttached();
                await expect(targetRow.getByText(hiddenSpoilerTag, { exact: true })).not.toBeAttached();
                const targetTitle = targetRow.getByTestId("ranking-title");
                await expectRenderedTitle(targetTitle, japaneseTitle, titleMinimumWidths[width]);

                const [tagBox, scoreBox] = await Promise.all([
                    targetRow.getByText(longEnglishTag, { exact: true }).boundingBox(),
                    targetRow.getByTestId("ranking-score").boundingBox(),
                ]);
                if (!tagBox || !scoreBox) throw new Error("Expected rendered ranking tag and score boxes");
                const boxesAreSeparate =
                    tagBox.x + tagBox.width <= scoreBox.x ||
                    scoreBox.x + scoreBox.width <= tagBox.x ||
                    tagBox.y + tagBox.height <= scoreBox.y ||
                    scoreBox.y + scoreBox.height <= tagBox.y;
                expect(boxesAreSeparate).toBe(true);

                if (width === 390) {
                    await page.evaluate(() => localStorage.setItem("vn-manager-lang", "en"));
                    await page.reload();
                    await expect(page.locator("html")).toHaveAttribute("lang", "en");
                    await expectRenderedTitle(
                        page.locator('a[href="/vn/v4"]').getByTestId("ranking-title"),
                        englishTitle,
                        titleMinimumWidths[width],
                    );
                }

                if (width === 320 || width === 1280) {
                    await page.locator('a[href="/vn/v4"]').scrollIntoViewIfNeeded();
                    await captureViewport(page, `issue-52-ranking-${width}.png`);
                }
            } finally {
                await context.close();
            }
        }
    });

    test("shows an image-independent shelf title at every roadmap width", async ({ browser }) => {
        const minimumWidths = { 320: 100, 390: 120, 768: 115, 1280: 130 } as const;

        for (const width of responsiveWidths) {
            const { context, page } = await createShelfPage(browser, width);
            try {
                await expectShelfTitle(page, minimumWidths[width]);
                if (width === 390) {
                    await page.evaluate(() => localStorage.setItem("vn-manager-lang", "en"));
                    await page.reload();
                    await expect(page.locator("html")).toHaveAttribute("lang", "en");
                    await expectRenderedTitle(page.getByTestId("shelf-title-link"), englishTitle, minimumWidths[width]);
                }
                if (width === 320 || width === 1280) {
                    await captureViewport(page, `issue-52-shelf-${width}.png`);
                }
            } finally {
                await context.close();
            }
        }
    });

    test("opens the visible ranking title with mouse, touch, and keyboard", async ({ browser }) => {
        const modes = [
            { name: "mouse", width: 390, touch: false },
            { name: "touch", width: 390, touch: true },
            { name: "keyboard", width: 320, touch: false },
        ] as const;

        for (const mode of modes) {
            const { context, page } = await createFixturePage(browser, mode.width, { touch: mode.touch });
            try {
                await seedLibraryItems(page, [makeLibraryItem(makeLongTitleVN("v4"), 0, 1)]);
                await page.reload();
                await page.goto("/ranking");

                const row = page.locator('a[href="/vn/v4"]');
                await expect(row).toContainText("#1");
                await expectRenderedTitle(row.getByTestId("ranking-title"), japaneseTitle, mode.width === 320 ? 120 : 150);

                if (mode.name === "mouse") {
                    await row.getByTestId("ranking-title").click();
                } else if (mode.name === "touch") {
                    const box = await row.getByTestId("ranking-title").boundingBox();
                    if (!box) throw new Error("Expected a touch target for the visible ranking title");
                    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
                } else {
                    let reachedRow = false;
                    for (let index = 0; index < 40; index += 1) {
                        await page.keyboard.press("Tab");
                        if (await row.evaluate((element) => element === document.activeElement)) {
                            reachedRow = true;
                            break;
                        }
                    }
                    expect(reachedRow).toBe(true);
                    await expect(row).toBeFocused();
                    await page.keyboard.press("Enter");
                }

                await expect(page).toHaveURL(/\/vn\/v4$/);
            } finally {
                await context.close();
            }
        }
    });

    test("opens the visible image-less shelf title with mouse, touch, and keyboard and returns to the shelf", async ({ browser }) => {
        const mouseFixture = await createShelfPage(browser, 390);
        try {
            const titleLink = await expectShelfTitle(mouseFixture.page, 120);
            await titleLink.click();
            await expectReturnedToShelf(mouseFixture.page);
        } finally {
            await mouseFixture.context.close();
        }

        const touchFixture = await createShelfPage(browser, 390, true);
        try {
            const titleLink = await expectShelfTitle(touchFixture.page, 120);
            const box = await titleLink.boundingBox();
            if (!box) throw new Error("Expected a touch target for the visible shelf title");
            await touchFixture.page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
            await expectReturnedToShelf(touchFixture.page);
        } finally {
            await touchFixture.context.close();
        }

        const keyboardFixture = await createShelfPage(browser, 320);
        try {
            const titleLink = await expectShelfTitle(keyboardFixture.page, 100);
            let reachedTitle = false;
            for (let index = 0; index < 40; index += 1) {
                await keyboardFixture.page.keyboard.press("Tab");
                if (await titleLink.evaluate((element) => element === document.activeElement)) {
                    reachedTitle = true;
                    break;
                }
            }
            expect(reachedTitle).toBe(true);
            await expect(titleLink).toBeFocused();
            await keyboardFixture.page.keyboard.press("Enter");
            await expectReturnedToShelf(keyboardFixture.page);
        } finally {
            await keyboardFixture.context.close();
        }
    });
});
