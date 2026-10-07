import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import fixture from "./fixtures/vndb.json";
import {
    armBackupRestoreFailure,
    failBackupRestoreWrites,
    mockVNDB,
    openAdditionalRecordFields,
    readLibraryIds,
    readLibraryItem,
    readPurchaseSourceNames,
    seedLibraryItem,
    seedPurchaseSources,
} from "./helpers";

const BACKGROUND_IMAGE = "https://t.vndb.org/backup-background.png";

async function setBackupFile(page: Page, value: unknown, name = "backup.json") {
    const contents = typeof value === "string" ? value : JSON.stringify(value);
    await page.locator('input[type="file"]').setInputFiles({
        name,
        mimeType: "application/json",
        buffer: Buffer.from(contents),
    });
}

function backupWithItems(library: unknown[], settings = {
    language: "ja",
    backgroundImage: null,
    nsfwBlur: true,
}) {
    return {
        schemaVersion: 2,
        exportedAt: "2026-10-01T00:00:00.000Z",
        library,
        purchaseSources: ["Imported Store"],
        settings,
    };
}

async function mockBackupBackground(page: Page) {
    await page.route(BACKGROUND_IMAGE, async (route) => {
        await route.fulfill({
            contentType: "image/svg+xml",
            body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#fff"/></svg>',
        });
    });
}

test.describe("V2-13 backup restore safety", () => {
    test("round-trips all saved fields and settings into a fresh browser context", async ({ page, browser }) => {
        await mockVNDB(page);
        await mockBackupBackground(page);
        await page.addInitScript((backgroundImage) => {
            localStorage.setItem("vn-manager-lang", "ja");
            localStorage.setItem("vn-manager-bg", backgroundImage);
            localStorage.setItem("vn-manager-nsfw-blur", "false");
        }, BACKGROUND_IMAGE);
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.goto("/");
        await seedLibraryItem(page, "v1", {
            status: "completed",
            ownership: "owned",
            score: 0,
            notes: "private notes zero",
            review: "review zero",
            playTime: 750,
            purchaseLocation: "Steam",
            startedOn: "2024-01-02",
            completedOn: "2024-03-04",
            lastPlayedOn: "2024-03-05",
            resumeNote: "resume after the final route",
            addedAt: 100,
            updatedAt: 200,
        });
        await seedLibraryItem(page, "v2", {
            status: "on_hold",
            ownership: "wishlist",
            score: null,
            notes: "private notes null",
            review: "review null",
            playTime: 0,
            purchaseLocation: "GOG",
            startedOn: "2025-02-03",
            lastPlayedOn: "2025-02-04",
            resumeNote: "resume the side route",
            addedAt: 300,
            updatedAt: 400,
        });
        await seedPurchaseSources(page, ["GOG", "Steam"]);
        await page.reload();
        await page.goto("/vn/v1");
        await openAdditionalRecordFields(page);
        await page.getByTestId("detail-notes-section").locator("summary").click();
        const notes = page.getByRole("textbox", { name: "メモ（自分用）", exact: true });
        await notes.fill("private notes zero saved through the form");
        await page.getByRole("button", { name: "記録を保存", exact: true }).click();
        await expect(page.getByText("本記録は保存済み", { exact: true })).toBeVisible();
        await page.reload();
        await openAdditionalRecordFields(page);
        await page.getByTestId("detail-notes-section").locator("summary").click();
        await expect(notes).toHaveValue("private notes zero saved through the form");
        await page.goto("/settings");
        const sourceRecords = {
            v1: await readLibraryItem(page, "v1"),
            v2: await readLibraryItem(page, "v2"),
        };
        expect(sourceRecords.v1).toBeDefined();
        expect(sourceRecords.v2).toBeDefined();
        await expect(page.locator("html")).toHaveAttribute("lang", "ja");
        await expect(page.locator("#settings-nsfw-blur")).toHaveAttribute("aria-checked", "false");
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
            path: "e2e/screenshots/v2-13-backup-1440x1000-ja.png",
            animations: "disabled",
        });

        const [download] = await Promise.all([
            page.waitForEvent("download"),
            page.getByRole("button", { name: "バックアップをダウンロード (JSON)", exact: true }).click(),
        ]);
        const downloadPath = await download.path();
        expect(downloadPath).not.toBeNull();
        const exported = JSON.parse(await readFile(downloadPath as string, "utf8")) as {
            schemaVersion: number;
            library: Array<Record<string, unknown>>;
            purchaseSources: string[];
            settings: Record<string, unknown>;
        };
        expect(exported.schemaVersion).toBe(2);
        expect(exported.library).toHaveLength(2);
        expect(exported.purchaseSources).toEqual(["DMM", "GOG", "Package", "Steam"]);
        const exportedItems = Object.fromEntries(exported.library.map((item) => [
            (item.vn as { id: string }).id,
            item,
        ]));
        expect(exportedItems.v1).toEqual(sourceRecords.v1);
        expect(exportedItems.v2).toEqual(sourceRecords.v2);
        expect(exported.settings).toEqual({
            language: "ja",
            backgroundImage: BACKGROUND_IMAGE,
            nsfwBlur: false,
        });
        expect(exported.library.find((item) => (item.vn as { id: string }).id === "v1")).toMatchObject({
            status: "completed",
            ownership: "owned",
            score: 0,
            notes: "private notes zero saved through the form",
            review: "review zero",
            playTime: 750,
            purchaseLocation: "Steam",
            startedOn: "2024-01-02",
            completedOn: "2024-03-04",
            lastPlayedOn: "2024-03-05",
            resumeNote: "resume after the final route",
            addedAt: 100,
            updatedAt: expect.any(Number),
        });
        expect(exported.library.find((item) => (item.vn as { id: string }).id === "v2")).toMatchObject({
            ownership: "wishlist",
            score: null,
            notes: "private notes null",
            review: "review null",
            playTime: 0,
            purchaseLocation: "GOG",
        });

        const emptyContext = await browser.newContext();
        try {
            const emptyPage = await emptyContext.newPage();
            await mockVNDB(emptyPage);
            await mockBackupBackground(emptyPage);
            await emptyPage.setViewportSize({ width: 390, height: 844 });
            await emptyPage.goto("/settings");
            await emptyPage.locator('input[type="file"]').setInputFiles(downloadPath as string);
            const preview = emptyPage.getByRole("dialog");
            await expect(preview.locator("dl dd").nth(1)).toHaveText("2");
            await expect(preview.locator("dl dd").nth(2)).toHaveText("2");
            await expect(preview.locator("dl dd").nth(3)).toHaveText("0");
            await preview.getByRole("button", { name: "復元する", exact: true }).click();
            await expect(emptyPage.getByRole("status").filter({ hasText: "復元しました" })).toBeVisible();
            await expect.poll(() => readLibraryIds(emptyPage)).toEqual(["v1", "v2"]);
            await expect.poll(() => readPurchaseSourceNames(emptyPage)).toEqual(["DMM", "GOG", "Package", "Steam"]);
            expect(await readLibraryItem(emptyPage, "v1")).toEqual(sourceRecords.v1);
            expect(await readLibraryItem(emptyPage, "v2")).toEqual(sourceRecords.v2);
            expect(await readLibraryItem(emptyPage, "v1")).toMatchObject({
                ownership: "owned",
                score: 0,
                notes: "private notes zero saved through the form",
                review: "review zero",
                playTime: 750,
                purchaseLocation: "Steam",
                startedOn: "2024-01-02",
                completedOn: "2024-03-04",
                lastPlayedOn: "2024-03-05",
                resumeNote: "resume after the final route",
                addedAt: 100,
                updatedAt: expect.any(Number),
            });
            expect(await readLibraryItem(emptyPage, "v2")).toMatchObject({
                ownership: "wishlist",
                score: null,
                notes: "private notes null",
                review: "review null",
                playTime: 0,
                purchaseLocation: "GOG",
                startedOn: "2025-02-03",
                lastPlayedOn: "2025-02-04",
                resumeNote: "resume the side route",
                addedAt: 300,
                updatedAt: 400,
            });
            await expect(emptyPage.locator("html")).toHaveAttribute("lang", "ja");
            await expect(emptyPage.locator("#settings-nsfw-blur")).toHaveAttribute("aria-checked", "false");
            await expect(emptyPage.getByRole("status").filter({ hasText: "背景画像が設定されています" })).toBeVisible();
            await expect.poll(() => emptyPage.evaluate(() => ({
                language: localStorage.getItem("vn-manager-lang"),
                backgroundImage: localStorage.getItem("vn-manager-bg"),
                nsfwBlur: localStorage.getItem("vn-manager-nsfw-blur"),
            }))).toEqual({
                language: "ja",
                backgroundImage: BACKGROUND_IMAGE,
                nsfwBlur: "false",
            });
            await emptyPage.reload();
            await expect(emptyPage.locator("html")).toHaveAttribute("lang", "ja");
            await expect(emptyPage.locator("#settings-nsfw-blur")).toHaveAttribute("aria-checked", "false");
            await expect(emptyPage.getByRole("status").filter({ hasText: "背景画像が設定されています" })).toBeVisible();

            await emptyPage.getByRole("button", { name: "英語", exact: true }).click();
            await expect(emptyPage.locator("html")).toHaveAttribute("lang", "en");
            await emptyPage.setViewportSize({ width: 390, height: 844 });
            await emptyPage.evaluate(() => window.scrollTo(0, 0));
            await emptyPage.screenshot({
                path: "e2e/screenshots/v2-13-backup-390x844-en.png",
                animations: "disabled",
            });

        } finally {
            await emptyContext.close();
        }
    });

    test("rejects malformed and invalid backups before writes, and cancel leaves data and settings unchanged", async ({ page }) => {
        await mockVNDB(page);
        await page.goto("/");
        await seedLibraryItem(page, "v1", { score: 44, notes: "saved data" });
        await seedPurchaseSources(page, ["Steam"]);
        await page.reload();
        await page.goto("/settings");
        const recordBefore = await readLibraryItem(page, "v1");
        const sourcesBefore = await readPurchaseSourceNames(page);
        const settingsBefore = await page.evaluate(() => ({
            language: localStorage.getItem("vn-manager-lang"),
            backgroundImage: localStorage.getItem("vn-manager-bg"),
            nsfwBlur: localStorage.getItem("vn-manager-nsfw-blur"),
        }));

        await setBackupFile(page, "{not valid json", "malformed.json");
        await expect(page.getByRole("alert").filter({ hasText: "バックアップを復元できません" })).toBeVisible();
        await expect(page.getByRole("dialog")).not.toBeVisible();
        expect(await readLibraryIds(page)).toEqual(["v1"]);

        const invalidItem = {
            recordVersion: 2,
            vn: structuredClone(fixture.vns.v2),
            status: "completed",
            ownership: "owned",
            score: 101,
            notes: "invalid score",
            addedAt: 10,
            updatedAt: 20,
        };
        await setBackupFile(page, backupWithItems([invalidItem]), "invalid-score.json");
        await expect(page.getByRole("alert").filter({ hasText: "library[0].score" })).toBeVisible();
        await expect(page.getByRole("dialog")).not.toBeVisible();
        expect(await readLibraryItem(page, "v1")).toEqual(recordBefore);
        expect(await readPurchaseSourceNames(page)).toEqual(sourcesBefore);

        const validItem = {
            recordVersion: 2,
            vn: structuredClone(fixture.vns.v2),
            status: "completed",
            ownership: "owned",
            score: null,
            notes: "must be cancelled",
            addedAt: 10,
            updatedAt: 20,
        };
        await setBackupFile(page, backupWithItems([validItem]), "after-validation.json");
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await dialog.getByRole("button", { name: "キャンセル", exact: true }).click();
        await expect(dialog).not.toBeVisible();
        expect(await readLibraryIds(page)).toEqual(["v1"]);
        expect(await readLibraryItem(page, "v1")).toEqual(recordBefore);
        expect(await readPurchaseSourceNames(page)).toEqual(sourcesBefore);
        expect(await page.evaluate(() => ({
            language: localStorage.getItem("vn-manager-lang"),
            backgroundImage: localStorage.getItem("vn-manager-bg"),
            nsfwBlur: localStorage.getItem("vn-manager-nsfw-blur"),
        }))).toEqual(settingsBefore);
    });

    test("shows restore failure in the preview and retry preserves a newer update from another tab", async ({ page, context }) => {
        await failBackupRestoreWrites(page);
        await mockVNDB(page);
        await page.setViewportSize({ width: 390, height: 667 });
        await page.goto("/");
        await seedLibraryItem(page, "v1", {
            status: "playing",
            ownership: "owned",
            score: 60,
            notes: "before other tab",
            purchaseLocation: "Existing Store",
        });
        await seedPurchaseSources(page, ["Existing Store"]);
        await page.reload();
        await page.goto("/settings");
        const incomingV1 = {
            recordVersion: 2,
            vn: structuredClone(fixture.vns.v1),
            status: "completed",
            ownership: "wishlist",
            score: 80,
            notes: "stale backup value",
            addedAt: 10,
            updatedAt: 20,
        };
        const incomingV2 = {
            recordVersion: 2,
            vn: structuredClone(fixture.vns.v2),
            status: "plan_to_play",
            ownership: "unknown",
            score: null,
            notes: "new game from backup",
            addedAt: 30,
            updatedAt: 40,
        };
        const sourcesBefore = await readPurchaseSourceNames(page);
        const backup = backupWithItems([incomingV1, incomingV2], {
            language: "en",
            backgroundImage: null,
            nsfwBlur: false,
        });
        await setBackupFile(page, backup, "restore-retry.json");
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText("2");
        await expect(dialog.getByRole("checkbox")).not.toBeChecked();

        const otherTab = await context.newPage();
        await mockVNDB(otherTab);
        await otherTab.goto("/vn/v1");
        await expect(otherTab.locator("#detail-score")).toHaveValue("60");
        await otherTab.locator("#detail-score").fill("99");
        await otherTab.getByTestId("detail-notes-section").locator("summary").click();
        await otherTab.locator("#detail-notes").fill("latest from another tab");
        await otherTab.getByRole("button", { name: "記録を保存", exact: true }).click();
        await expect(otherTab.getByText("本記録は保存済み", { exact: true })).toBeVisible();
        await expect.poll(() => readLibraryItem(otherTab, "v1")).toMatchObject({
            score: 99,
            notes: "latest from another tab",
        });

        await armBackupRestoreFailure(page);
        await dialog.getByRole("button", { name: "復元する", exact: true }).click();
        await expect(dialog.getByRole("alert")).toContainText("データの読み込みに失敗しました");
        await expect(page.getByText("データの読み込みに失敗しました", { exact: true })).toHaveCount(1);
        await expect(dialog.getByRole("button", { name: "復元する", exact: true })).toBeEnabled();
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
            path: "e2e/screenshots/v2-13-restore-preview-390x667-ja.png",
            animations: "disabled",
        });
        expect(await readLibraryIds(page)).toEqual(["v1"]);
        await expect.poll(() => readPurchaseSourceNames(page)).toEqual(sourcesBefore);
        await expect.poll(() => readLibraryItem(page, "v1")).toMatchObject({
            score: 99,
            notes: "latest from another tab",
        });

        await dialog.getByRole("button", { name: "復元する", exact: true }).click();
        await expect(page.getByRole("status").filter({ hasText: "復元しました" })).toBeVisible();
        await expect.poll(() => readLibraryIds(page)).toEqual(["v1", "v2"]);
        expect(await readLibraryItem(page, "v1")).toMatchObject({
            score: 99,
            notes: "latest from another tab",
        });
        expect(await readLibraryItem(page, "v2")).toMatchObject({
            status: "plan_to_play",
            score: null,
            notes: "new game from backup",
        });
        await expect.poll(() => readPurchaseSourceNames(page)).toEqual(["Existing Store", "Imported Store"]);
        await expect(page.locator("html")).toHaveAttribute("lang", "en");
        await expect(page.locator("#settings-nsfw-blur")).toHaveAttribute("aria-checked", "false");
        await otherTab.close();
    });
});
