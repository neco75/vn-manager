import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { mockVNDB, readLibraryItem, seedLibraryItem } from "./helpers";

const privateMemo = "V2-11 private memo must stay out of the share";

test.describe("V2-11 statistics and share output", () => {
    test("keeps empty and unrated states distinct from a zero average", async ({ page }) => {
        await mockVNDB(page);
        await page.goto("/stats");

        await expect(page.getByTestId("stats-empty-state")).toContainText("まだ記録がありません。");
        await expect(page.getByTestId("stats-share-root")).toHaveCount(0);
        await expect(page.getByRole("button", { name: "画像をシェア", exact: true })).toBeDisabled();

        await seedLibraryItem(page, "v1", { score: null });
        await page.reload();

        const summary = page.getByTestId("stats-summary-grid");
        await expect(summary.getByText("—", { exact: true })).toBeVisible();
        await expect(summary.getByText("評価済み 0件", { exact: true })).toBeVisible();
        await expect(summary.getByText("0.0", { exact: true })).toHaveCount(0);
        await expect(page.getByRole("button", { name: "画像をシェア", exact: true })).toBeEnabled();
    });

    test("shows accurate aggregate bars and creates a white share PNG without changing records", async ({ page }) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.setViewportSize({ width: 1440, height: 1000 });
        await mockVNDB(page);
        await page.goto("/stats");
        await seedLibraryItem(page, "v1", {
            status: "completed",
            score: 0,
            playTime: 30,
            completedOn: "2025-12-31",
            notes: privateMemo,
            review: "Private review",
        });
        await seedLibraryItem(page, "v2", {
            status: "completed",
            score: 100,
            playTime: 90,
            completedOn: "2026-01-01",
        });
        await seedLibraryItem(page, "v3", {
            status: "completed",
            score: null,
            playTime: 60,
        });
        await seedLibraryItem(page, "v4", {
            status: "plan_to_play",
            ownership: "owned",
            score: null,
        });
        await page.reload();

        const shareRoot = page.getByTestId("stats-share-root");
        await expect(shareRoot).toBeVisible();
        await expect(page.getByTestId("stats-summary-card")).toHaveCount(4);
        const summaryGrid = page.getByTestId("stats-summary-grid");
        const chartGrid = page.getByTestId("stats-chart-grid");
        const desktopSummaryColumns = await summaryGrid.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
        const desktopChartColumns = await chartGrid.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
        expect(desktopSummaryColumns).toBe(4);
        expect(desktopChartColumns).toBe(2);
        const summaryTypography = await summaryGrid.getByTestId("stats-summary-card").nth(2).evaluate((card) =>
            Array.from(card.children).map((element) => getComputedStyle(element).fontSize),
        );
        expect(summaryTypography).toEqual(["14px", "24px", "13px"]);
        await expect(summaryGrid.getByTestId("stats-summary-card").nth(0)).toContainText("4");
        await expect(summaryGrid.getByTestId("stats-summary-card").nth(1)).toContainText("3");
        await expect(summaryGrid.getByTestId("stats-summary-card").nth(2)).toContainText("50.0");
        await expect(page.getByText("評価済み 2件", { exact: true })).toBeVisible();
        await expect(page.getByText("記録した時間", { exact: true }).locator("..")).toContainText("3時間");
        await expect(page.getByText("推定総所要時間", { exact: true }).locator("../..")).toContainText("2時間");
        await expect(page.getByText("2025-12", { exact: true })).toBeVisible();
        await expect(page.getByText("2026-01", { exact: true })).toBeVisible();
        await expect(page.getByText("クリア日未設定 1件", { exact: true })).toBeVisible();
        await expect(page.getByRole("progressbar", { name: "クリア済み", exact: true })).toHaveAttribute("aria-valuenow", "3");
        await expect(page.getByRole("progressbar", { name: "プレイ予定", exact: true })).toHaveAttribute("aria-valuenow", "1");
        await expect(page.getByText("Hidden route", { exact: true })).not.toBeVisible();
        await expect(page.getByText("Unknown tag", { exact: true })).not.toBeVisible();
        await expect(shareRoot).not.toContainText(privateMemo);
        await expect(shareRoot).not.toContainText("Private review");
        await expect(shareRoot.locator("button, input, select, textarea")).toHaveCount(0);
        await expect(shareRoot).toHaveCSS("background-color", "rgb(255, 255, 255)");

        const bars = page.getByRole("progressbar");
        await expect(bars).toHaveCount(11);
        const measurements = await bars.evaluateAll((elements) => elements.map((element) => {
            const track = element.getBoundingClientRect().width;
            const fill = element.firstElementChild?.getBoundingClientRect().width ?? 0;
            return {
                value: Number(element.getAttribute("aria-valuenow")),
                max: Number(element.getAttribute("aria-valuemax")),
                track,
                fill,
            };
        }));
        for (const bar of measurements) {
            expect(bar.max).toBeGreaterThan(0);
            expect(Math.abs(bar.fill - (bar.track * bar.value) / bar.max)).toBeLessThanOrEqual(2);
        }

        await page.screenshot({
            path: path.resolve("e2e/screenshots/v2-11-stats-1440x1000.png"),
            fullPage: true,
        });
        await page.getByRole("button", { name: "EN", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Stats", exact: true })).toBeVisible();
        await page.setViewportSize({ width: 390, height: 844 });
        const mobileColumns = await summaryGrid.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
        const mobileChartColumns = await chartGrid.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
        expect(mobileColumns).toBe(2);
        expect(mobileChartColumns).toBe(1);
        await page.screenshot({
            path: path.resolve("e2e/screenshots/v2-11-stats-390x844.png"),
            fullPage: true,
        });

        const original = await readLibraryItem(page, "v1");
        expect(original).not.toBeUndefined();
        await page.evaluate(() => {
            const prototype = HTMLCanvasElement.prototype as unknown as {
                toDataURL: (...args: unknown[]) => string;
            };
            const originalToDataURL = prototype.toDataURL;
            prototype.toDataURL = () => {
                prototype.toDataURL = originalToDataURL;
                throw new Error("fixture share failure");
            };
        });

        const shareButton = page.getByRole("button", { name: "Share Image", exact: true });
        await shareButton.click();
        await expect(page.getByRole("button", { name: "Generating image...", exact: true })).toBeVisible();
        await expect(page.getByText("Failed to generate image", { exact: true })).toBeVisible();
        await expect(shareButton).toBeEnabled();

        const downloadPromise = page.waitForEvent("download");
        await shareButton.click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toBe("my-vn-stats.png");
        const downloadPath = await download.path();
        expect(downloadPath).not.toBeNull();
        const png = await readFile(downloadPath!);
        expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
        const pixels = await page.evaluate(async (base64) => {
            const image = new Image();
            image.src = `data:image/png;base64,${base64}`;
            await image.decode();
            const canvas = document.createElement("canvas");
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            const context = canvas.getContext("2d");
            if (!context) throw new Error("Canvas context unavailable");
            context.drawImage(image, 0, 0);
            return {
                width: image.naturalWidth,
                height: image.naturalHeight,
                topLeft: Array.from(context.getImageData(0, 0, 1, 1).data),
            };
        }, png.toString("base64"));
        expect(pixels.width).toBeGreaterThan(500);
        expect(pixels.height).toBeGreaterThan(300);
        expect(pixels.topLeft).toEqual([255, 255, 255, 255]);
        expect(await readLibraryItem(page, "v1")).toEqual(original);
    });

    test("shows refresh progress, allows retry after failure, and preserves personal record fields", async ({ page }) => {
        await mockVNDB(page);
        await page.goto("/stats");
        await seedLibraryItem(page, "v1", {
            status: "playing",
            ownership: "owned",
            score: 0,
            playTime: 37,
            startedOn: "2025-03-01",
            lastPlayedOn: "2025-03-12",
            resumeNote: "Keep this resume note",
            notes: privateMemo,
            review: "Keep this review",
            purchaseLocation: "Fixture store",
        });
        await page.reload();
        const before = await readLibraryItem(page, "v1");
        expect(before).not.toBeUndefined();

        let releaseFirstRequest!: () => void;
        let markRequestStarted!: () => void;
        const releaseFirst = new Promise<void>((resolve) => { releaseFirstRequest = resolve; });
        const requestStarted = new Promise<void>((resolve) => { markRequestStarted = resolve; });
        let failFirstRequest = true;
        await page.route("**/api.vndb.org/kana/vn", async (route) => {
            const body = route.request().postDataJSON() as { filters?: unknown[] };
            if (failFirstRequest && Array.isArray(body.filters) && body.filters[0] === "id") {
                failFirstRequest = false;
                markRequestStarted();
                await releaseFirst;
                await route.fulfill({
                    status: 503,
                    contentType: "application/json",
                    body: JSON.stringify({ error: "fixture refresh failure" }),
                });
                return;
            }
            await route.fallback();
        });

        const refreshButton = page.getByRole("button", { name: "NSFW情報を更新", exact: true });
        await refreshButton.click();
        await requestStarted;
        await expect(page.getByRole("dialog")).toBeVisible();
        await expect(page.getByRole("dialog")).toContainText("VNDBから情報を取得しています...");
        releaseFirstRequest();

        await expect(page.getByText("情報の更新に失敗しました", { exact: true })).toBeVisible();
        await expect(refreshButton).toBeEnabled();
        expect(await readLibraryItem(page, "v1")).toEqual(before);

        await refreshButton.click();
        await expect(page.getByText("1件のNSFW情報を更新しました", { exact: true })).toBeVisible();
        const after = await readLibraryItem(page, "v1");
        expect(after).not.toBeUndefined();
        expect({ ...after!, vn: undefined, updatedAt: undefined }).toEqual({
            ...before!,
            vn: undefined,
            updatedAt: undefined,
        });
    });
});
