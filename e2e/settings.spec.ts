import { expect, test } from "@playwright/test";

test.describe("settings", () => {
    test("offers add and restore paths from an empty library", async ({ page }) => {
        await page.goto("/");

        await expect(page.getByRole("link", { name: "作品を追加", exact: true })).toHaveAttribute("href", "/search");
        await expect(page.getByRole("link", { name: "バックアップから復元", exact: true })).toHaveAttribute(
            "href",
            "/settings#backup",
        );

        await page.getByRole("link", { name: "バックアップから復元", exact: true }).click();
        await expect(page).toHaveURL(/\/settings#backup$/);
        await expect(page.getByRole("heading", { name: "設定", exact: true })).toBeVisible();
    });

    test("persists language and records the final export time", async ({ page }) => {
        await page.goto("/settings");

        const exportButton = page.getByRole("button", { name: "バックアップをダウンロード (JSON)", exact: true });
        const [download] = await Promise.all([
            page.waitForEvent("download"),
            exportButton.click(),
        ]);
        expect(download.suggestedFilename()).toMatch(/^vn-manager-backup-\d{4}-\d{2}-\d{2}\.json$/);
        await expect(page.getByText(/^最終エクスポート: /)).toBeVisible();
        await expect(page.evaluate(() => localStorage.getItem("vn-manager-last-export-at"))).resolves.not.toBeNull();

        const blurSwitch = page.locator("#settings-nsfw-blur");
        await blurSwitch.click();
        await expect(blurSwitch).toHaveAttribute("aria-checked", "false");

        await page.getByRole("button", { name: "英語", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("lang", "en");
        await page.reload();
        await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
        await expect(page.locator("#settings-nsfw-blur")).toHaveAttribute("aria-checked", "false");
        await expect(page.getByRole("button", { name: "Japanese", exact: true })).toHaveAttribute(
            "aria-pressed",
            "false",
        );
    });

    test("reaches settings from the mobile menu", async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto("/");

        await page.getByRole("button", { name: "メニュー", exact: true }).click();
        await page.getByRole("link", { name: "設定", exact: true }).click();
        await expect(page).toHaveURL(/\/settings$/);
        await expect(page.getByRole("heading", { name: "設定", exact: true })).toBeVisible();
    });

    test("manages purchase locations from settings", async ({ page }) => {
        await page.goto("/settings");

        await page.getByRole("button", { name: "購入先を追加", exact: true }).click();
        await page.getByRole("textbox", { name: "購入先の名前", exact: true }).fill("Steam");
        await page.getByRole("button", { name: "確定", exact: true }).click();
        await expect(page.getByRole("button", { name: "購入先を管理", exact: true })).toBeVisible();

        await page.getByRole("button", { name: "購入先を管理", exact: true }).click();
        await expect(page.getByRole("dialog")).toContainText("Steam");
    });
});
