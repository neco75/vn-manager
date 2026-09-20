import { expect, test, type APIRequestContext } from "@playwright/test";
import { failLibraryWrites, FIXTURE_STATUS_URL, mockVNDB, seedLibraryItem } from "./helpers";

async function search(page: Parameters<typeof mockVNDB>[0], query: string) {
    const input = page.getByLabel("タイトルで検索");
    await input.fill(query);
    await input.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/search\\?q=${query}$`));
}

async function expectServerMetadataFixture(request: APIRequestContext, id: string) {
    const response = await request.get(FIXTURE_STATUS_URL);
    expect(response.ok()).toBe(true);
    const status = await response.json() as { metadataRequests: Record<string, number> };
    expect(status.metadataRequests[id] ?? 0).toBeGreaterThan(0);
}

test.describe("search flows", () => {
    test("restores the search state after visiting a detail page", async ({ page, request }) => {
        await mockVNDB(page);
        await page.goto("/search");

        await search(page, "normal");
        await expect(page.getByText("Fixture VN One", { exact: true })).toBeVisible();
        await expect(page.locator('a[href="/vn/v1"]')).toHaveCount(2);

        await page.locator('a[href="/vn/v1"]').first().click();
        await expect(page).toHaveURL(/\/vn\/v1$/);
        await expect(page.getByRole("heading", { name: "Fixture VN One" })).toBeVisible();
        await expectServerMetadataFixture(request, "v1");

        await page.goBack();
        await expect(page).toHaveURL(/\/search\?q=normal$/);
        await expect(page.getByLabel("タイトルで検索")).toHaveValue("normal");
        await expect(page.getByText("Fixture VN One", { exact: true })).toBeVisible();
    });

    test("covers empty, retry, load-more, duplicate, and load-more failure states", async ({ page }) => {
        await mockVNDB(page, { failRetryOnce: true, failLoadMore: true });
        await page.goto("/search");

        await search(page, "empty");
        await expect(page.getByText("「empty」に一致する作品がありません", { exact: true })).toBeVisible();

        await search(page, "retry");
        await expect(page.getByText("検索に失敗しました", { exact: true })).toBeVisible();
        await page.getByRole("button", { name: "再試行", exact: true }).click();
        await expect(page.getByText("Fixture VN One", { exact: true })).toBeVisible();

        await search(page, "normal");
        await page.getByRole("button", { name: "もっと見る", exact: true }).click();
        await expect(page.getByText("Fixture VN Three", { exact: true })).toBeVisible();
        // v2 is returned on both pages, but the UI keeps one card (two detail links).
        await expect(page.locator('a[href="/vn/v2"]')).toHaveCount(2);

        await search(page, "load-fail");
        await page.getByRole("button", { name: "もっと見る", exact: true }).click();
        await expect(page.locator('p[role="alert"]')).toContainText("追加の取得に失敗しました");
        await expect(page.getByText("Fixture VN One", { exact: true })).toBeVisible();
    });

    test("uses localized titles and keeps long card titles identifiable on narrow screens", async ({ page }) => {
        await mockVNDB(page);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto("/search");

        await search(page, "title-cases");
        const japaneseTitle = "日本語の長いタイトル 続編 ファンディスク";
        const englishTitle = "English Sequel Fan Disc Title";
        const titleLink = page.locator('a[href="/vn/v4"]').filter({ hasText: japaneseTitle });
        await expect(titleLink).toBeVisible();
        await expect(titleLink).toHaveClass(/line-clamp-2/);

        await page.evaluate(() => localStorage.setItem("vn-manager-lang", "en"));
        await page.reload();
        await expect(page.getByText(englishTitle, { exact: true })).toBeVisible();
    });

    test("ignores stale searches and clears an interrupted load-more state", async ({ page }) => {
        await mockVNDB(page);
        await page.goto("/search");
        const input = page.getByLabel("タイトルで検索");

        await input.fill("race-a");
        await input.press("Enter");
        await expect(page.getByRole("button", { name: "検索", exact: true })).toBeDisabled();
        await input.fill("race-b");
        await expect(page.getByRole("button", { name: "検索", exact: true })).toBeEnabled();
        await input.press("Enter");
        await expect(page).toHaveURL(/\/search\?q=race-b$/);
        await expect(page.getByText("Fixture VN Two", { exact: true })).toBeVisible();
        await expect(page.getByText("Fixture VN One", { exact: true })).not.toBeVisible();
        await page.waitForTimeout(1_000);

        await search(page, "page-race-a");
        await page.getByRole("button", { name: "もっと見る", exact: true }).click();
        await input.fill("page-race-b");
        await input.press("Enter");
        await expect(page).toHaveURL(/\/search\?q=page-race-b$/);
        await expect(page.getByText("Fixture VN Two", { exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "読み込み中...", exact: true })).not.toBeVisible();
    });
});

test.describe("library flows", () => {
    test("adds a search result with the default status and persists registered state", async ({ page }) => {
        await mockVNDB(page);
        await page.goto("/search");
        await search(page, "normal");

        await page.getByRole("button", { name: "ライブラリに追加", exact: true }).first().click();
        await expect(page.getByText("登録済み", { exact: true }).first()).toBeVisible();

        await page.reload();
        await expect(page.getByText("登録済み", { exact: true }).first()).toBeVisible();
    });

    test("does not expose re-add for an existing record or overwrite its score", async ({ page }) => {
        await mockVNDB(page);
        await page.goto("/");
        await seedLibraryItem(page, "v1", { status: "completed", score: 80, notes: "keep this record" });
        await page.reload();
        await page.goto("/search");
        await search(page, "normal");

        await expect(page.getByText("登録済み", { exact: true }).first()).toBeVisible();
        await expect(page.getByRole("button", { name: "ライブラリに追加", exact: true })).toHaveCount(1);

        await page.locator('a[href="/vn/v1"]').first().click();
        await expect(page.locator("#detail-score")).toHaveValue("80");
    });

    test("keeps the status dialog open and shows a nearby error when IndexedDB save fails", async ({ page }) => {
        await failLibraryWrites(page);
        await mockVNDB(page);
        await page.goto("/search");
        await search(page, "failure");

        await page.getByRole("button", { name: "ステータス", exact: true }).click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await dialog.getByRole("button", { name: "このステータスで追加", exact: true }).click();

        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole("alert")).toContainText("ライブラリへの追加に失敗しました");
        await expect(dialog.getByRole("combobox")).toContainText("プレイ予定");
    });

    test("keeps local records visible when VNDB fails and hides unsafe content by default", async ({ page, request }) => {
        await mockVNDB(page, { detailError: true });
        await page.goto("/");
        await seedLibraryItem(page, "v1");
        await page.reload();
        await page.goto("/vn/v1");

        await expect(page.getByRole("heading", { name: "Fixture VN One" })).toBeVisible();
        await expectServerMetadataFixture(request, "v1");
        await expect(page.getByText("VNDBから最新情報を取得できませんでした。", { exact: true })).toBeVisible();
        await expect(page.getByText("Visible intro", { exact: false })).toBeVisible();
        await expect(page.getByText("hidden ending", { exact: true })).not.toBeAttached();
        await expect(page.getByRole("button", { name: /ネタバレを表示/ }).first()).toBeVisible();
        await expect(page.locator('img[alt="Fixture VN One"]').first()).toHaveClass(/blur-2xl/);
    });
});
