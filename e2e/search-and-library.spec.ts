import { expect, test, type APIRequestContext } from "@playwright/test";
import { failDetailDraftWrites, failLibraryWrites, FIXTURE_STATUS_URL, mockVNDB, seedLibraryItem } from "./helpers";

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
    test("syncs the search input when the header returns to the library", async ({ page }) => {
        await mockVNDB(page);
        await page.goto("/");
        await seedLibraryItem(page, "v1");
        await seedLibraryItem(page, "v2");
        await seedLibraryItem(page, "v4");
        await page.reload();

        const input = page.getByRole("searchbox", { name: "登録作品のタイトル・別名・ブランドを検索" });
        await input.pressSequentially("Title Works");
        await expect(input).toHaveValue("Title Works");
        await expect(page.getByText("日本語の長いタイトル 続編 ファンディスク", { exact: true })).toBeVisible();

        await page.getByRole("link", { name: "ライブラリ", exact: true }).click();
        await expect(page).toHaveURL(/\/$/);
        await expect(input).toHaveValue("");
        await expect(page.getByText("一致3件 / 全3件", { exact: true })).toBeVisible();
    });

    test("searches saved titles, combines filters, and restores the library URL from detail", async ({ page, request }) => {
        await mockVNDB(page);
        await page.goto("/");
        await seedLibraryItem(page, "v1", { status: "completed", ownership: "owned", score: 0, addedAt: 1 });
        await seedLibraryItem(page, "v2", { status: "playing", ownership: "wishlist", score: null, addedAt: 2 });
        await seedLibraryItem(page, "v4", { status: "playing", ownership: "unknown", score: 75, addedAt: 3 });
        await page.reload();

        const input = page.getByRole("searchbox", { name: "登録作品のタイトル・別名・ブランドを検索" });
        await input.pressSequentially("Title Works");
        await expect(page.getByText("日本語の長いタイトル 続編 ファンディスク", { exact: true })).toBeVisible();
        await expect(page.getByText("VNDB 6.5/10", { exact: true })).toBeVisible();
        await expect(page.getByText("Fixture VN One", { exact: true })).not.toBeVisible();
        await expect(page).toHaveURL(/q=Title\+Works/);

        await page.getByRole("tab", { name: /プレイ中/ }).click();
        const ownership = page.getByRole("combobox", { name: "所有状況" });
        await ownership.click();
        await page.getByRole("option", { name: "未設定", exact: true }).click();
        await page.getByRole("combobox", { name: "並び替え" }).click();
        await page.getByRole("option", { name: "スコア (低い順)", exact: true }).click();
        await page.getByRole("button", { name: "リスト表示" }).click();

        await expect(page).toHaveURL(/q=Title\+Works&status=playing&ownership=unknown&sort=score_asc&view=list/);
        await expect(page.getByRole("button", { name: "リスト表示" })).toHaveAttribute("aria-pressed", "true");
        await expect(page.getByText("未評価", { exact: true })).not.toBeVisible();

        await page.getByText("日本語の長いタイトル 続編 ファンディスク", { exact: true }).click();
        await expect(page).toHaveURL(/\/vn\/v4\?from=/);
        await expectServerMetadataFixture(request, "v4");
        await page.getByRole("link", { name: "戻る", exact: true }).click();

        await expect(page).toHaveURL(/q=Title\+Works&status=playing&ownership=unknown&sort=score_asc&view=list/);
        await expect(input).toHaveValue("Title Works");
        await expect(page.getByRole("button", { name: "リスト表示" })).toHaveAttribute("aria-pressed", "true");
        await page.getByRole("button", { name: "条件を解除", exact: true }).click();
        await expect(page).toHaveURL(/sort=score_asc&view=list/);
        await expect(input).toHaveValue("");
        await expect(page.getByText("0/100", { exact: true })).toBeVisible();
        await expect(page.getByText("未評価", { exact: true })).toBeVisible();

        await page.goto("/?q=missing&status=invalid&ownership=invalid&sort=invalid&view=invalid");
        await expect(page).toHaveURL(/\/\?q=missing$/);
        await expect(page.getByText("条件に一致する作品がありません", { exact: true })).toBeVisible();
        await expect(page.getByText("ライブラリが空です", { exact: true })).not.toBeVisible();
    });

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

    test("restores and isolates detail drafts without changing saved records", async ({ page }) => {
        await mockVNDB(page);
        await page.goto("/");
        await seedLibraryItem(page, "v1", { notes: "saved memo" });
        await seedLibraryItem(page, "v2", { review: "saved review for v2" });
        await page.reload();
        await page.goto("/vn/v1");

        const review = page.getByRole("textbox", { name: "感想・レビュー" });
        await review.fill("draft review for v1");
        await expect(page.getByText("下書き保存済み・記録には未反映", { exact: true })).toBeVisible();

        await page.getByRole("link", { name: "ライブラリ", exact: true }).click();
        await expect(page).toHaveURL(/\/$/);
        await page.goto("/vn/v2");
        await expect(page.getByRole("textbox", { name: "感想・レビュー" })).toHaveValue("saved review for v2");
        await expect(page.getByRole("button", { name: "下書きを復元" })).not.toBeVisible();

        await page.goto("/vn/v1");
        await expect(page.getByText("この作品に未反映の下書きがあります。復元しますか？", { exact: true })).toBeVisible();
        await expect(review).toBeDisabled();
        await expect(page.getByRole("button", { name: "変更を保存", exact: true })).toBeDisabled();
        await page.getByRole("button", { name: "下書きを破棄" }).click();
        await expect(page.getByRole("button", { name: "下書きを復元" })).not.toBeVisible();
        await expect(page.getByRole("textbox", { name: "感想・レビュー" })).toHaveValue("");
    });

    test("clears a detail draft only after the record save succeeds", async ({ page }) => {
        await mockVNDB(page);
        await page.goto("/");
        await seedLibraryItem(page, "v1");
        await page.reload();
        await page.goto("/vn/v1");

        const review = page.getByRole("textbox", { name: "感想・レビュー" });
        await review.fill("saved after draft");
        await expect(page.getByText("下書き保存済み・記録には未反映", { exact: true })).toBeVisible();
        await review.fill("latest unsaved input");
        await expect(page.getByText("未保存の変更", { exact: true })).toBeVisible();
        await expect(page.getByText("下書き保存済み・記録には未反映", { exact: true })).not.toBeVisible();
        await expect(page.getByText("下書き保存済み・記録には未反映", { exact: true })).toBeVisible();
        await page.getByRole("button", { name: "変更を保存", exact: true }).click();
        await expect(page.getByText("本記録は保存済み", { exact: true })).toBeVisible();

        await page.reload();
        await expect(page.getByRole("button", { name: "下書きを復元" })).not.toBeVisible();
        await expect(page.getByRole("textbox", { name: "感想・レビュー" })).toHaveValue("latest unsaved input");

        await review.fill("draft after record save");
        await expect(page.getByText("下書き保存済み・記録には未反映", { exact: true })).toBeVisible();
        await page.getByRole("link", { name: "ライブラリ", exact: true }).click();
        await page.goto("/vn/v1");
        await expect(page.getByText("この作品に未反映の下書きがあります。復元しますか？", { exact: true })).toBeVisible();
        await expect(page.getByText("保存済み記録が下書き作成後に更新されています。内容を確認してから復元してください。", { exact: true })).not.toBeVisible();
        await page.getByRole("button", { name: "下書きを復元" }).click();
        await expect(page.getByRole("textbox", { name: "感想・レビュー" })).toHaveValue("draft after record save");
    });

    test("restores memo and review from a draft with values outside record validation", async ({ page }) => {
        await mockVNDB(page);
        await page.goto("/");
        await seedLibraryItem(page, "v1", {
            notes: "saved memo",
            review: "saved review",
            score: 80,
            playTime: 60,
        });
        await page.reload();
        await page.goto("/vn/v1");

        const notes = page.getByRole("textbox", { name: "メモ (非公開)" });
        const review = page.getByRole("textbox", { name: "感想・レビュー" });
        const score = page.getByRole("spinbutton", { name: "スコア" });
        const playTime = page.getByRole("spinbutton", { name: "プレイ時間 (時間)" });

        await notes.fill("draft memo survives invalid values");
        await review.fill("draft review survives invalid values");
        await score.fill("101");
        await playTime.fill("-1");
        await expect(page.getByText("下書き保存済み・記録には未反映", { exact: true })).toBeVisible();

        page.once("dialog", (dialog) => void dialog.accept());
        await page.reload();
        await expect(page.getByText("この作品に未反映の下書きがあります。復元しますか？", { exact: true })).toBeVisible();
        await page.getByRole("button", { name: "下書きを復元" }).click();

        await expect(notes).toHaveValue("draft memo survives invalid values");
        await expect(review).toHaveValue("draft review survives invalid values");
        await expect(score).toHaveValue("101");
        await expect(playTime).toHaveValue("-1");

        await page.getByRole("button", { name: "変更を保存", exact: true }).click();
        await expect(page.getByText(/スコアは.*0.*100/).last()).toBeVisible();

        await score.fill("80");
        await page.getByRole("button", { name: "変更を保存", exact: true }).click();
        await expect(page.getByText(/プレイ時間は0以上/).last()).toBeVisible();
        await expect(notes).toHaveValue("draft memo survives invalid values");
        await expect(review).toHaveValue("draft review survives invalid values");
    });

    test("explains an unreadable stored draft instead of silently discarding it", async ({ page }) => {
        await mockVNDB(page);
        await page.addInitScript(() => {
            localStorage.setItem("vn-manager-detail-draft-v1:v1", "{broken-json");
        });
        await page.goto("/");
        await seedLibraryItem(page, "v1", { notes: "saved memo" });
        await page.reload();
        await page.goto("/vn/v1");

        await expect(page.getByRole("alert").filter({ hasText: "下書きを読み書きできません" })).toBeVisible();
        await expect(page.evaluate(() => localStorage.getItem("vn-manager-detail-draft-v1:v1")))
            .resolves.toBe("{broken-json");
        await expect(page.getByRole("textbox", { name: "メモ (非公開)" })).toHaveValue("saved memo");
    });

    test("keeps detail actions keyboard reachable on a narrow screen", async ({ page }) => {
        await mockVNDB(page);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto("/");
        await seedLibraryItem(page, "v1");
        await page.reload();
        await page.goto("/vn/v1");

        await expect(page.getByRole("heading", { name: "Fixture VN One" })).toBeVisible();
        const saveButton = page.getByRole("button", { name: "変更を保存", exact: true });
        await expect(saveButton).toBeVisible();
        await page.getByRole("textbox", { name: "感想・レビュー" }).fill("keyboard save");
        await saveButton.focus();
        await expect(saveButton).toBeFocused();
        await page.keyboard.press("Enter");
        await expect(page.getByText("本記録は保存済み", { exact: true })).toBeVisible();
    });

    test("locks an unregistered VN until its pending draft is resolved", async ({ page }) => {
        await mockVNDB(page);
        await page.goto("/vn/v1");

        const review = page.getByRole("textbox", { name: "感想・レビュー" });
        await review.fill("pending before add");
        await expect(page.getByText("下書き保存済み・記録には未反映", { exact: true })).toBeVisible();
        await page.getByRole("link", { name: "ライブラリ", exact: true }).click();
        await page.goto("/vn/v1");

        await expect(page.getByText("この作品に未反映の下書きがあります。復元しますか？", { exact: true })).toBeVisible();
        await expect(review).toBeDisabled();
        await expect(page.getByRole("button", { name: "ライブラリに追加", exact: true })).toBeDisabled();
        await expect(page.getByRole("button", { name: "書く", exact: true }).first()).toHaveAttribute("aria-pressed", "true");
        await expect(page.getByRole("tab")).toHaveCount(0);

        await page.getByRole("button", { name: "下書きを復元" }).click();
        await expect(review).toBeEnabled();
        await expect(page.getByRole("button", { name: "ライブラリに追加", exact: true })).toBeEnabled();

        await page.getByRole("button", { name: "ライブラリに追加", exact: true }).click();
        await expect(page.getByText("本記録は保存済み", { exact: true })).toBeVisible();
        await review.fill("draft after first add");
        await expect(page.getByText("下書き保存済み・記録には未反映", { exact: true })).toBeVisible();
        await page.getByRole("link", { name: "ライブラリ", exact: true }).click();
        await page.goto("/vn/v1");
        await expect(page.getByText("この作品に未反映の下書きがあります。復元しますか？", { exact: true })).toBeVisible();
        await expect(page.getByText("保存済み記録が下書き作成後に更新されています。内容を確認してから復元してください。", { exact: true })).not.toBeVisible();
    });

    test("keeps detail input and draft protection when the record save fails", async ({ page }) => {
        await failLibraryWrites(page);
        await mockVNDB(page);
        await page.goto("/vn/v1");

        const review = page.getByRole("textbox", { name: "感想・レビュー" });
        await review.fill("record save failure keeps this");
        await page.getByRole("button", { name: "ライブラリに追加", exact: true }).click();

        await expect(page.getByText("保存に失敗しました。入力内容を残したまま再試行できます。", { exact: true })).toBeVisible();
        await expect(review).toHaveValue("record save failure keeps this");
        await expect(page.getByText("下書き保存済み・記録には未反映", { exact: true })).toBeVisible();
    });

    test("shows an unprotected state when draft storage fails", async ({ page }) => {
        await failDetailDraftWrites(page);
        await mockVNDB(page);
        await page.goto("/");
        await seedLibraryItem(page, "v1");
        await page.reload();
        await page.goto("/vn/v1");

        await page.getByRole("textbox", { name: "感想・レビュー" }).fill("cannot persist");
        await expect(page.getByText("下書きを保存できませんでした。入力は残っています。", { exact: true })).toBeVisible();
        await expect(page.getByText("下書き保存済み・記録には未反映", { exact: true })).not.toBeVisible();
        await expect(page.getByRole("textbox", { name: "感想・レビュー" })).toHaveValue("cannot persist");
    });
});
