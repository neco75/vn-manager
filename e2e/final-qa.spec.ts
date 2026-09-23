import { readFile } from "node:fs/promises";
import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import fixture from "./fixtures/vndb.json";
import {
    failBackupRestoreWrites,
    armBackupRestoreFailure,
    FIXTURE_STATUS_URL,
    mockVNDB,
    readLibraryIds,
    readLibraryItem,
    readPurchaseSourceNames,
    seedLibraryItem,
    seedPurchaseSources,
} from "./helpers";

async function search(page: Page, query: string) {
    const input = page.getByLabel("タイトルで検索");
    await input.fill(query);
    await input.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/search\\?q=${query}$`));
}

async function setJsonFile(page: Page, value: unknown, name = "backup.json") {
    await page.locator('input[type="file"]').setInputFiles({
        name,
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(value)),
    });
}

async function expectNoHorizontalOverflow(page: Page) {
    await expect.poll(() => page.evaluate(() => {
        const width = document.documentElement.clientWidth;
        return Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0) <= width + 1;
    })).toBe(true);
}

async function tabUntilFocused(page: Page, target: Locator, reverse = false) {
    for (let attempt = 0; attempt < 80; attempt += 1) {
        if (await target.evaluate((element) => element === document.activeElement)) return;
        await page.keyboard.press(reverse ? "Shift+Tab" : "Tab");
    }
    throw new Error(`Could not reach ${await target.getAttribute("aria-label")} with Tab`);
}

function legacyBackup() {
    return [{
        vn: structuredClone(fixture.vns.v1),
        status: "completed",
        score: 75,
        notes: "legacy memo",
        review: "legacy review",
        playTime: 90,
        purchaseLocation: "Package",
        addedAt: 100,
        updatedAt: 200,
    }];
}

function versionedBackup() {
    return {
        schemaVersion: 2,
        exportedAt: "2026-09-20T00:00:00.000Z",
        library: [{
            recordVersion: 2,
            vn: structuredClone(fixture.vns.v2),
            status: "completed",
            ownership: "owned",
            score: 82,
            notes: "round-trip memo",
            addedAt: 100,
            updatedAt: 200,
        }],
        purchaseSources: ["Package"],
        settings: {
            language: "ja",
            backgroundImage: null,
            nsfwBlur: true,
        },
    };
}

function invalidTrailingTitleBackup() {
    const backup = versionedBackup();
    return {
        ...backup,
        library: [
            ...backup.library,
            {
                ...backup.library[0],
                vn: {
                    ...structuredClone(fixture.vns.v3),
                    titles: { ja: "invalid" },
                },
            },
        ],
        purchaseSources: ["Imported Store"],
        settings: {
            language: "ja",
            backgroundImage: null,
            nsfwBlur: true,
        },
    };
}

async function expectServerMetadataFixture(request: APIRequestContext, id: string) {
    const response = await request.get(FIXTURE_STATUS_URL);
    expect(response.ok()).toBe(true);
    const status = await response.json() as { metadataRequests: Record<string, number> };
    expect(status.metadataRequests[id] ?? 0).toBeGreaterThan(0);
}

test.describe("final roadmap acceptance", () => {
    test("completes the first-use flow and preserves the personal record after reload", async ({ page, request }) => {
        await mockVNDB(page);
        await page.goto("/");

        await page.getByRole("link", { name: "作品を追加", exact: true }).click();
        await search(page, "normal");
        await page.locator('a[href="/vn/v1"]').first().click();
        await expect(page.getByRole("heading", { name: "Fixture VN One", exact: true })).toBeVisible();
        await expectServerMetadataFixture(request, "v1");

        await page.locator("#detail-score").fill("88");
        await page.getByRole("textbox", { name: "メモ (非公開)" }).fill("first-use memo");
        await page.locator("details").locator("summary").click();
        await page.locator("#detail-ownership").click();
        await page.getByRole("option", { name: "所有済み", exact: true }).click();
        await page.getByRole("button", { name: "ライブラリに追加", exact: true }).click();
        await expect(page.getByText("本記録は保存済み", { exact: true })).toBeVisible();

        await page.reload();
        await expect(page.locator("#detail-score")).toHaveValue("88");
        await expect(page.getByRole("textbox", { name: "メモ (非公開)" })).toHaveValue("first-use memo");
        await expect(page.locator("#detail-ownership")).toContainText("所有済み");
    });

    test("imports the legacy array format with every personal record field", async ({ page }) => {
        await mockVNDB(page);
        await page.goto("/settings");
        await setJsonFile(page, legacyBackup(), "legacy.json");

        const dialog = page.getByRole("dialog");
        await expect(dialog).toContainText("旧形式");
        await dialog.getByRole("button", { name: "復元する", exact: true }).click();
        await expect(page.getByRole("status").filter({ hasText: "復元しました" })).toBeVisible();

        const restored = await readLibraryItem(page, "v1");
        expect(restored).toMatchObject({
            status: "completed",
            score: 75,
            notes: "legacy memo",
            review: "legacy review",
            playTime: 90,
            purchaseLocation: "Package",
            addedAt: 100,
            updatedAt: 200,
        });

        await page.goto("/vn/v1");
        await expect(page.locator("#detail-score")).toHaveValue("75");
        await expect(page.locator("#detail-play-time")).toHaveValue("1.5");
        await expect(page.getByRole("textbox", { name: "メモ (非公開)" })).toHaveValue("legacy memo");
        await expect(page.getByRole("textbox", { name: "感想・レビュー" })).toHaveValue("legacy review");
    });

    test("exports a new backup and restores it into an empty browser profile", async ({ page, browser }) => {
        await mockVNDB(page);
        await page.goto("/");
        await seedLibraryItem(page, "v1", {
            status: "completed",
            ownership: "owned",
            score: 82,
            notes: "round-trip memo",
            updatedAt: 200,
        });
        await page.reload();
        await page.goto("/settings");

        const [download] = await Promise.all([
            page.waitForEvent("download"),
            page.getByRole("button", { name: "バックアップをダウンロード (JSON)", exact: true }).click(),
        ]);
        const downloadPath = await download.path();
        expect(downloadPath).not.toBeNull();
        const downloadedBackup = JSON.parse(await readFile(downloadPath as string, "utf8")) as {
            schemaVersion?: number;
            exportedAt?: string;
            library?: unknown[];
            purchaseSources?: unknown[];
            settings?: unknown;
        };
        expect(downloadedBackup.schemaVersion).toBe(2);
        expect(downloadedBackup.exportedAt).toEqual(expect.any(String));
        expect(downloadedBackup.library).toHaveLength(1);
        expect(downloadedBackup.purchaseSources).toEqual(expect.any(Array));
        expect(downloadedBackup.settings).toEqual(expect.objectContaining({ nsfwBlur: true }));

        const emptyContext = await browser.newContext();
        try {
            const emptyPage = await emptyContext.newPage();
            await mockVNDB(emptyPage);
            await emptyPage.goto("/settings");
            await emptyPage.locator('input[type="file"]').setInputFiles(downloadPath as string);
            await emptyPage.getByRole("dialog").getByRole("button", { name: "復元する", exact: true }).click();
            await expect(emptyPage.getByRole("status").filter({ hasText: "復元しました" })).toBeVisible();

            await emptyPage.goto("/vn/v1");
            await expect(emptyPage.locator("#detail-score")).toHaveValue("82");
            await expect(emptyPage.getByRole("textbox", { name: "メモ (非公開)" })).toHaveValue("round-trip memo");
        } finally {
            await emptyContext.close();
        }
    });

    test("rejects an invalid backup without changing existing data", async ({ page }) => {
        await mockVNDB(page);
        await page.goto("/");
        await seedLibraryItem(page, "v1", { score: 44, notes: "keep existing" });
        await page.reload();
        await page.goto("/settings");
        await setJsonFile(page, { schemaVersion: 999 }, "invalid.json");

        await expect(page.locator('p[role="alert"]')).toContainText("バックアップを復元できません");
        expect(await readLibraryIds(page)).toEqual(["v1"]);
        const existing = await readLibraryItem(page, "v1");
        expect(existing).toMatchObject({ score: 44, notes: "keep existing" });
    });

    test("rejects invalid trailing VN title data before changing library, purchases, or settings", async ({ page }) => {
        await mockVNDB(page);
        await page.addInitScript(() => {
            localStorage.setItem("vn-manager-lang", "en");
            localStorage.setItem("vn-manager-nsfw-blur", "false");
        });
        await page.goto("/");
        await seedLibraryItem(page, "v1", { score: 44, notes: "keep existing" });
        await page.reload();
        await page.goto("/settings");

        await expect(page.locator("html")).toHaveAttribute("lang", "en");
        await expect(page.locator("#settings-nsfw-blur")).toHaveAttribute("aria-checked", "false");
        const purchaseSourcesBefore = await readPurchaseSourceNames(page);
        await setJsonFile(page, invalidTrailingTitleBackup(), "invalid-trailing-title.json");

        await expect(page.locator('p[role="alert"]')).toContainText(
            "library[1].vn.titles: must be an array",
        );
        expect(await readLibraryIds(page)).toEqual(["v1"]);
        expect(await readPurchaseSourceNames(page)).toEqual(purchaseSourcesBefore);
        expect(await page.evaluate(() => localStorage.getItem("vn-manager-lang"))).toBe("en");
        expect(await page.evaluate(() => localStorage.getItem("vn-manager-nsfw-blur"))).toBe("false");

        await page.goto("/");
        await expect(page.getByText("Fixture VN One", { exact: true })).toBeVisible();
    });

    test("rolls back library writes when purchase-source restore fails mid-transaction", async ({ page }) => {
        await failBackupRestoreWrites(page);
        await mockVNDB(page);
        await page.goto("/");
        await seedLibraryItem(page, "v1");
        await seedPurchaseSources(page, ["Existing Store"]);
        const purchaseSourcesBefore = await readPurchaseSourceNames(page);
        await page.reload();
        await page.goto("/settings");
        await setJsonFile(page, versionedBackup(), "restore-failure.json");
        await armBackupRestoreFailure(page);
        await page.getByRole("dialog").getByRole("button", { name: "復元する", exact: true }).click();

        await page.getByRole("dialog").getByRole("button", { name: "キャンセル", exact: true }).click();
        await expect(page.locator('p[role="alert"]')).toContainText("データの読み込みに失敗しました");
        expect(await readLibraryIds(page)).toEqual(["v1"]);
        expect(await readPurchaseSourceNames(page)).toEqual(purchaseSourcesBefore);
    });

    test("keeps local records editable and saved while VNDB detail requests fail", async ({ page }) => {
        await mockVNDB(page, { detailError: true });
        await page.goto("/");
        await seedLibraryItem(page, "v1", { notes: "before failure" });
        await page.reload();
        await page.goto("/vn/v1");

        await expect(page.getByText("VNDBから最新情報を取得できませんでした。", { exact: true })).toBeVisible();
        await expect(page.getByText("保存済みの作品情報と個人記録は引き続き閲覧・編集・保存できます。", { exact: true })).toBeVisible();
        await page.getByRole("textbox", { name: "メモ (非公開)" }).fill("saved while VNDB is down");
        await page.getByRole("button", { name: "変更を保存", exact: true }).click();
        await expect(page.getByText("本記録は保存済み", { exact: true })).toBeVisible();

        await page.reload();
        await expect(page.getByText("VNDBから最新情報を取得できませんでした。", { exact: true })).toBeVisible();
        await expect(page.getByRole("textbox", { name: "メモ (非公開)" })).toHaveValue("saved while VNDB is down");
    });

    test("applies image safety to cards, list, shelf, ranking, roulette, detail, gallery, and backgrounds", async ({ page }) => {
        await mockVNDB(page);
        await page.goto("/");
        await seedLibraryItem(page, "v3", { status: "completed", score: 80 });
        await page.reload();

        await expect(page.locator('img[alt="Fixture VN Three"]').first()).toHaveClass(/blur-xl/);

        await page.getByRole("button", { name: "リスト表示", exact: true }).click();
        await expect(page.locator('img[src*="/3/cover.jpg"]').first()).toHaveClass(/blur-md/);
        await page.getByRole("button", { name: "本棚表示", exact: true }).click();
        await expect(page.locator('img[alt="Fixture VN Three"]').first()).toHaveClass(/blur-xl/);

        await page.goto("/ranking");
        await expect(page.locator('img[alt=""]').first()).toHaveClass(/blur-md/);

        await page.goto("/");
        await page.getByRole("button", { name: "ルーレット", exact: true }).click();
        const roulette = page.getByRole("dialog");
        await roulette.getByRole("button", { name: "ルーレットを回す！", exact: true }).click();
        await expect(roulette.getByText("運命の一作！", { exact: true })).toBeVisible({ timeout: 5_000 });
        await expect(roulette.locator('img[alt="Fixture VN Three"]')).toHaveClass(/blur-xl/);

        await page.goto("/vn/v3");
        await expect(page.locator('img[alt="Fixture VN Three"]').first()).toHaveClass(/blur-2xl/);
        const detailBackground = page.locator('div[style*="/3/cover.jpg"]').first();
        await expect(detailBackground).toHaveClass(/blur-3xl/);

        await page.getByRole("button", { name: /ギャラリー/ }).click();
        await page.getByRole("button", { name: "スクリーンショット 1", exact: true }).click();
        await expect(page.getByRole("dialog").locator('img[alt="スクリーンショット 1"]')).toHaveClass(/blur-3xl/);
        await page.keyboard.press("Escape");

        await page.goto("/");
        await page.locator("#desktop-nsfw-blur").click();
        await expect(page.locator('img[alt="Fixture VN Three"]').first()).not.toHaveClass(/blur-xl/);
        await page.locator("#desktop-nsfw-blur").click();

        await page.goto("/vn/v1");
        await page.getByRole("button", { name: /作品情報/ }).click();
        await page.getByRole("button", { name: "背景に設定", exact: true }).click();
        await expect(page.evaluate(() => localStorage.getItem("vn-manager-bg-sexual"))).resolves.toBeNull();
        const backgroundClasses = await page.locator('div[style*="/1/cover.jpg"]').evaluateAll((elements) =>
            elements.map((element) => String(element.className)),
        );
        expect(backgroundClasses.some((className) => className.includes("fixed") && className.includes("blur-3xl"))).toBe(true);
    });

    test("does not expose spoiler synopsis or tags before explicit reveal", async ({ page }) => {
        await mockVNDB(page);
        await page.goto("/vn/v1");

        await expect(page.getByText("hidden ending", { exact: true })).not.toBeAttached();
        await page.getByRole("button", { name: /タグ/ }).click();
        await expect(page.getByText("Hidden route", { exact: true })).not.toBeAttached();

        const revealButtons = page.getByRole("button", { name: /ネタバレを表示/ });
        await expect(revealButtons).toHaveCount(2);
        await revealButtons.last().click();
        await expect(page.getByText("Hidden route", { exact: false })).toBeVisible();
        await page.getByRole("button", { name: /ネタバレを表示/ }).click();
        await expect(page.getByText("hidden ending", { exact: true })).toBeVisible();
    });

    test("keeps major actions reachable within the viewport at every roadmap width", async ({ browser }) => {
        for (const width of [320, 390, 768, 1280]) {
            const context = await browser.newContext({ viewport: { width, height: 900 } });
            try {
                const page = await context.newPage();
                await mockVNDB(page);
                await page.goto("/");
                await expect(page.getByRole("link", { name: "作品を追加", exact: true })).toBeVisible();
                await expectNoHorizontalOverflow(page);

                await page.getByRole("link", { name: "作品を追加", exact: true }).click();
                await expect(page).toHaveURL(/\/search$/);
                await expectNoHorizontalOverflow(page);
                await search(page, "normal");
                await expect(page.getByText("Fixture VN One", { exact: true })).toBeVisible();
                await expectNoHorizontalOverflow(page);

                await page.locator('a[href="/vn/v1"]').first().click();
                await expect(page.getByRole("heading", { name: "Fixture VN One", exact: true })).toBeVisible();
                await expectNoHorizontalOverflow(page);
                await page.locator("#detail-score").fill("77");
                await page.getByRole("textbox", { name: "メモ (非公開)" }).fill(`responsive memo ${width}`);
                await page.getByRole("button", { name: "ライブラリに追加", exact: true }).click();
                await expect(page.getByText("本記録は保存済み", { exact: true })).toBeVisible();
                await expectNoHorizontalOverflow(page);

                await page.goto("/settings");
                await expect(page.getByRole("heading", { name: "設定", exact: true })).toBeVisible();
                await expectNoHorizontalOverflow(page);
                const [download] = await Promise.all([
                    page.waitForEvent("download"),
                    page.getByRole("button", { name: "バックアップをダウンロード (JSON)", exact: true }).click(),
                ]);
                expect(await download.path()).not.toBeNull();
            } finally {
                await context.close();
            }
        }
    });

    test("completes search, add, detail save, settings, and dialog checks with keyboard only", async ({ page }) => {
        await mockVNDB(page);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto("/");

        const addLink = page.getByRole("link", { name: "作品を追加", exact: true });
        await tabUntilFocused(page, addLink);
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(/\/search$/);

        const searchInput = page.getByLabel("タイトルで検索");
        await tabUntilFocused(page, searchInput);
        await searchInput.pressSequentially("normal");
        await searchInput.press("Enter");
        await expect(page.getByText("Fixture VN One", { exact: true })).toBeVisible();

        const detailLink = page.locator('a[href="/vn/v1"]').first();
        await tabUntilFocused(page, detailLink);
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(/\/vn\/v1$/);

        const score = page.locator("#detail-score");
        await tabUntilFocused(page, score);
        await page.keyboard.type("91");
        const memo = page.getByRole("textbox", { name: "メモ (非公開)" });
        await tabUntilFocused(page, memo);
        await page.keyboard.type("keyboard-only memo");
        const saveButton = page.getByRole("button", { name: "ライブラリに追加", exact: true });
        await tabUntilFocused(page, saveButton, true);
        await page.keyboard.press("Enter");
        await expect(page.getByText("本記録は保存済み", { exact: true })).toBeVisible();

        const menuButton = page.getByRole("button", { name: "メニュー", exact: true });
        await tabUntilFocused(page, menuButton, true);
        await page.keyboard.press("Enter");
        const menuDialog = page.getByRole("dialog");
        await expect(menuDialog).toBeVisible();
        const settingsLink = menuDialog.getByRole("link", { name: "設定", exact: true });
        await tabUntilFocused(page, settingsLink);
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(/\/settings$/);
    });

    test("traps focus in the mobile menu and returns focus after Escape", async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto("/");

        const menuButton = page.getByRole("button", { name: "メニュー", exact: true });
        await tabUntilFocused(page, menuButton);
        await page.keyboard.press("Enter");
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();

        await page.evaluate(() => document.activeElement?.setAttribute("data-final-qa-focus-start", "true"));
        let focusCycled = false;
        for (let attempt = 0; attempt < 40; attempt += 1) {
            await page.keyboard.press("Tab");
            const focusState = await page.evaluate(() => ({
                insideDialog: Boolean(document.activeElement?.closest('[role="dialog"]')),
                returnedToStart: document.activeElement?.getAttribute("data-final-qa-focus-start") === "true",
            }));
            expect(focusState.insideDialog).toBe(true);
            if (focusState.returnedToStart) {
                focusCycled = true;
                break;
            }
        }
        expect(focusCycled).toBe(true);
        await page.keyboard.press("Escape");
        await expect(dialog).not.toBeVisible();
        await expect(menuButton).toBeFocused();
    });
});
