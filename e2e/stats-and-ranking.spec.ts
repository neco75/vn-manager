import { expect, test } from "@playwright/test";
import { mockVNDB, seedLibraryItem } from "./helpers";

test.describe("stats and ranking", () => {
    test("separates recorded time, estimates, scores, dates, and safe tags", async ({ page }) => {
        await mockVNDB(page);
        await page.goto("/stats");
        await seedLibraryItem(page, "v1", {
            status: "playing",
            ownership: "owned",
            playTime: 0,
            score: 0,
        });
        await seedLibraryItem(page, "v2", {
            status: "watched",
            playTime: 120,
            score: 100,
        });
        await seedLibraryItem(page, "v3", {
            status: "plan_to_play",
            ownership: "owned",
        });
        await seedLibraryItem(page, "v4", {
            status: "completed",
            completedOn: "2025-12-31",
        });
        await page.reload();

        await expect(page.getByRole("heading", { name: "統計", exact: true })).toBeVisible();
        await expect(page.getByText("動画視聴は除外", { exact: false })).toBeVisible();
        await expect(page.getByText("2025-12", { exact: true })).toBeVisible();
        await expect(page.getByText("非ネタバレタグを作品数で集計", { exact: false })).toBeVisible();

        const recordedCard = page.getByText("記録した時間", { exact: true }).locator("..");
        await expect(recordedCard).toContainText("0時間");

        const estimatedCard = page.getByText("推定総所要時間", { exact: true }).locator("../..");
        await expect(estimatedCard).toContainText("3時間");

        await expect(page.getByText("50.0", { exact: true })).toBeVisible();
        await expect(page.getByText("評価済み 2件", { exact: true })).toBeVisible();
        await expect(page.getByText("Hidden route", { exact: true })).not.toBeVisible();
        await expect(page.getByText("Unknown tag", { exact: true })).not.toBeVisible();
    });

    test("shows competition ranks and includes an explicitly rated zero", async ({ page }) => {
        await mockVNDB(page);
        await page.goto("/ranking");
        await seedLibraryItem(page, "v1", { status: "completed", score: 100, addedAt: 20 });
        await seedLibraryItem(page, "v2", { status: "completed", score: 100, addedAt: 30 });
        await seedLibraryItem(page, "v3", { status: "completed", score: 0, addedAt: 40 });
        await seedLibraryItem(page, "v4", { status: "completed", score: null, addedAt: 50 });
        await page.reload();

        await expect(page.getByRole("heading", { name: "自分のランキング", exact: true })).toBeVisible();
        await expect(page.getByText("#1", { exact: true })).toHaveCount(2);
        await expect(page.getByText("#3", { exact: true })).toHaveCount(1);
        await expect(page.getByText("0", { exact: true })).toBeVisible();
        await expect(page.getByText("未評価", { exact: true })).not.toBeVisible();
        await expect(page.getByText("クリア済み", { exact: true })).toHaveCount(3);
    });
});
