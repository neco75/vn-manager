import { expect, test } from "@playwright/test";
import { failLibraryWrites, mockVNDB, readLibraryItem } from "./helpers";

test.describe("V2-09 search and add", () => {
    test("keeps previous results and their return query after a failed search, then retries", async ({ page }) => {
        await mockVNDB(page, { failRetryOnce: true });
        await page.goto("/search");

        const input = page.getByLabel("タイトルで検索");
        await input.fill("normal");
        await page.getByRole("button", { name: "検索", exact: true }).click();
        await expect(page.getByText("Fixture VN Two", { exact: true })).toBeVisible();

        await input.fill("retry");
        await page.getByRole("button", { name: "検索", exact: true }).click();
        await expect(page).toHaveURL(/\/search\?q=retry$/);
        await expect(page.getByText("検索に失敗しました", { exact: true })).toBeVisible();
        await expect(page.getByText("前回の「normal」の検索結果を表示しています。", { exact: true })).toBeVisible();
        await expect(page.getByText("Fixture VN Two", { exact: true })).toBeVisible();

        const previousResult = page.locator('a[href^="/vn/v2?from="]');
        await expect(previousResult).toHaveAttribute("href", "/vn/v2?from=%2Fsearch%3Fq%3Dnormal");
        await previousResult.click();
        await expect(page).toHaveURL(/\/vn\/v2\?from=%2Fsearch%3Fq%3Dnormal$/);
        await page.getByRole("link", { name: "戻る", exact: true }).click();
        await expect(page).toHaveURL(/\/search\?q=normal$/);
        await expect(page.getByText("Fixture VN Two", { exact: true })).toBeVisible();

        await input.fill("retry");
        await page.getByRole("button", { name: "検索", exact: true }).click();
        await expect(page.getByText("Fixture VN One", { exact: true })).toBeVisible();
        await expect(page.getByText("Fixture VN Two", { exact: true })).not.toBeVisible();
        await expect(page.getByText("検索に失敗しました", { exact: true })).not.toBeVisible();
    });

    test("keeps the result and URL in place when adding it fails", async ({ page }) => {
        await mockVNDB(page);
        await failLibraryWrites(page);
        await page.goto("/search");

        const input = page.getByLabel("タイトルで検索");
        await input.fill("normal");
        await page.getByRole("button", { name: "検索", exact: true }).click();
        await expect(page.getByText("Fixture VN One", { exact: true })).toBeVisible();

        const searchUrl = page.url();
        const addButton = page.getByRole("button", { name: "ライブラリに追加", exact: true }).first();
        await addButton.click();
        await expect(page).toHaveURL(searchUrl);
        await expect(page.getByText("ライブラリへの追加に失敗しました。もう一度お試しください。", { exact: true })).toBeVisible();
        await expect(addButton).toBeEnabled();
        await expect(page.getByText("Fixture VN One", { exact: true })).toBeVisible();
        expect(await readLibraryItem(page, "v1")).toBeUndefined();
    });

    test("uses the specified responsive grid and renders search cards in Japanese and English", async ({ page }) => {
        await mockVNDB(page);
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.goto("/search");

        const input = page.getByLabel("タイトルで検索");
        await input.fill("responsive");
        await page.getByRole("button", { name: "検索", exact: true }).click();
        await expect(page.getByText("日本語の長いタイトル 続編 ファンディスク", { exact: true })).toBeVisible();

        const grid = page.locator("div.grid.grid-cols-2.gap-3").first();
        for (const [width, columns, gap] of [[320, 2, 12], [390, 2, 12], [768, 3, 16], [1024, 4, 20], [1440, 4, 20]] as const) {
            await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
            const layout = await grid.evaluate((element) => {
                const style = getComputedStyle(element);
                return { columns: style.gridTemplateColumns.split(" ").length, gap: Number.parseFloat(style.columnGap) };
            });
            expect(layout).toEqual({ columns, gap });
        }

        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.screenshot({ path: "e2e/screenshots/v2-09-search-ja-1440x1000.png", animations: "disabled" });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ path: "e2e/screenshots/v2-09-search-ja-390x844.png", animations: "disabled" });

        await page.evaluate(() => localStorage.setItem("vn-manager-lang", "en"));
        await page.reload();
        await expect(page.getByLabel("Search by title")).toHaveValue("responsive");
        await expect(page.getByText("English Sequel Fan Disc Title", { exact: true })).toBeVisible();
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.screenshot({ path: "e2e/screenshots/v2-09-search-en-1440x1000.png", animations: "disabled" });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ path: "e2e/screenshots/v2-09-search-en-390x844.png", animations: "disabled" });
    });
});
