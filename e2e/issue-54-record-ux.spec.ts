import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
    mockVNDB,
    openAdditionalRecordFields,
    readLibraryItem,
    seedLibraryItem,
    seedPurchaseSources,
} from "./helpers";

const workTitle = "Fixture VN One";
const saveBarSelector = ".sticky";

async function captureViewport(page: Page, name: string) {
    const path = join(process.cwd(), "e2e", "screenshots", name);
    await mkdir(dirname(path), { recursive: true });
    await page.screenshot({ path, animations: "disabled" });
}

async function domOrder(page: Page, selectors: string[]) {
    return page.evaluate((targets) => targets.map((selector) => {
        const element = document.querySelector(selector);
        if (!element) return -1;
        return Array.prototype.indexOf.call(document.querySelectorAll("*"), element);
    }), selectors);
}

function saveBar(page: Page): Locator {
    return page.locator(saveBarSelector).filter({ has: page.getByRole("button", { name: "変更を保存", exact: true }) });
}

async function expectNoHorizontalOverflow(page: Page) {
    await expect.poll(() => page.evaluate(() => {
        const width = document.documentElement.clientWidth;
        return Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0) <= width + 1;
    })).toBe(true);
}

test.describe("Issue #54 record order and removal path", () => {
    test("reaches the resume note from the top of a 390x667 screen before the long editors", async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 667 });
        await mockVNDB(page);
        await page.goto("/");
        await seedLibraryItem(page, "v1", {
            status: "playing",
            resumeNote: "3日目・地下通路の再開位置",
            notes: "saved memo",
        });
        await page.reload();
        await page.goto("/vn/v1");

        const resumeNote = page.locator("#detail-resume-note");
        await expect(resumeNote).toBeVisible();
        await expect(resumeNote).toHaveValue("3日目・地下通路の再開位置");

        const box = await resumeNote.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.y).toBeGreaterThanOrEqual(0);
        expect(box!.y + box!.height).toBeLessThanOrEqual(667);

        // The Markdown editors load lazily, so wait for them before comparing DOM order.
        await expect(page.locator("#detail-notes")).toBeVisible();
        const order = await domOrder(page, [
            "#detail-resume-note",
            "#detail-status",
            "#detail-ownership",
            "#detail-notes",
            "#detail-review",
            "[data-testid=\"detail-additional-fields\"]",
        ]);
        expect(order.every((index) => index >= 0)).toBe(true);
        expect(order).toEqual([...order].sort((a, b) => a - b));

        await resumeNote.fill("3日目・地下通路から再開");
        await expect(page.getByText("未保存の変更", { exact: true })).toBeVisible();
        await page.getByRole("button", { name: "変更を保存", exact: true }).click();
        await expect(page.getByText("本記録は保存済み", { exact: true })).toBeVisible();
        await expect.poll(async () => (await readLibraryItem(page, "v1"))?.resumeNote)
            .toBe("3日目・地下通路から再開");
    });

    test("keeps the external information folded so it does not push the record down", async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 667 });
        await mockVNDB(page);
        await page.goto("/");
        await seedLibraryItem(page, "v1", { notes: "saved memo" });
        await page.reload();
        await page.goto("/vn/v1");

        const synopsis = page.getByRole("button", { name: "あらすじ", exact: true });
        await expect(synopsis).toHaveAttribute("aria-expanded", "false");
        await expect(page.getByText("Visible intro", { exact: false })).not.toBeAttached();
        await expect(page.getByText("hidden ending", { exact: true })).not.toBeAttached();

        await expect(page.locator("#detail-notes")).toBeVisible();
        const order = await domOrder(page, [
            "#detail-resume-note",
            "[data-testid=\"detail-additional-fields\"]",
            "[data-testid=\"detail-synopsis-icon\"]",
        ]);
        expect(order.every((index) => index >= 0)).toBe(true);
        expect(order[0]).toBeLessThan(order[1]);
        expect(order[1]).toBeLessThan(order[2]);

        await synopsis.click();
        await expect(synopsis).toHaveAttribute("aria-expanded", "true");
        await expect(page.getByText("Visible intro", { exact: false })).toBeVisible();
        await expect(page.getByText("hidden ending", { exact: true })).not.toBeAttached();
        await expect(page.getByRole("button", { name: /ネタバレを表示/ }).first()).toBeVisible();
    });

    test("separates removal from save and confirms the work and the lost record", async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 667 });
        await mockVNDB(page);
        await page.goto("/");
        await seedLibraryItem(page, "v1", { notes: "saved memo", score: 70 });
        await page.reload();
        await page.goto("/vn/v1");

        const saveBarElement = await saveBar(page).count();
        expect(saveBarElement).toBe(1);
        await expect(saveBar(page)).not.toContainText("ライブラリから削除");

        const removeButton = page.getByTestId("detail-delete-zone").getByRole("button", { name: "ライブラリから削除" });
        await expect(removeButton).toBeVisible();

        await removeButton.click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await expectNoHorizontalOverflow(page);
        await expect(dialog).toContainText("この作品をライブラリから削除しますか？");
        await expect(dialog).toContainText(workTitle);
        await expect(dialog).toContainText("ステータス・所有状況・スコア・プレイ時間・再開メモ・メモ・感想・購入先・各日付");
        await expect(dialog).toContainText("ゲーム本体やインストール済みのファイルは削除しません");
        await captureViewport(page, "issue-54-delete-confirm-320.png");

        await dialog.getByRole("button", { name: "キャンセル", exact: true }).click();
        await expect(dialog).not.toBeVisible();
        expect((await readLibraryItem(page, "v1"))?.notes).toBe("saved memo");

        await removeButton.click();
        await page.getByRole("dialog").getByRole("button", { name: "この記録を削除", exact: true }).click();
        await expect(page.getByText("削除しました", { exact: true })).toBeVisible();
        await expect(page.getByRole("dialog")).not.toBeVisible();
        await expect(page.getByTestId("detail-delete-zone")).not.toBeVisible();
        await expect(page.getByText("ライブラリには未登録", { exact: true })).toBeVisible();
        await expect.poll(async () => readLibraryItem(page, "v1")).toBeUndefined();
    });

    test("saves every auxiliary field from the collapsed section", async ({ page }) => {
        await mockVNDB(page);
        await page.goto("/");
        await seedLibraryItem(page, "v1", { score: 0 });
        await seedPurchaseSources(page, ["Steam"]);
        await page.reload();
        await page.goto("/vn/v1");

        await expect(page.locator("#detail-score")).toBeHidden();
        await openAdditionalRecordFields(page);

        await expect(page.getByTestId("detail-legacy-score-note")).toBeVisible();
        await page.locator("#detail-score").fill("85");
        await expect(page.getByTestId("detail-legacy-score-note")).not.toBeAttached();
        await page.locator("#detail-play-time").fill("12.5");
        await page.locator("#detail-started-on").fill("2026-01-05");
        await page.locator("#detail-completed-on").fill("2026-02-06");
        await page.locator("#detail-last-played-on").fill("2026-03-07");
        await page.getByRole("combobox", { name: "購入先を選択" }).click();
        await page.getByRole("option", { name: "Steam", exact: true }).click();

        await page.getByRole("button", { name: "変更を保存", exact: true }).click();
        await expect(page.getByText("本記録は保存済み", { exact: true })).toBeVisible();

        await page.reload();
        await openAdditionalRecordFields(page);
        await expect(page.locator("#detail-score")).toHaveValue("85");
        await expect(page.locator("#detail-play-time")).toHaveValue("12.5");
        await expect(page.locator("#detail-started-on")).toHaveValue("2026-01-05");
        await expect(page.locator("#detail-completed-on")).toHaveValue("2026-02-06");
        await expect(page.locator("#detail-last-played-on")).toHaveValue("2026-03-07");
        await expect(page.getByRole("combobox", { name: "購入先を選択" })).toContainText("Steam");
        await expect.poll(async () => {
            const item = await readLibraryItem(page, "v1");
            return { playTime: item?.playTime, purchaseLocation: item?.purchaseLocation };
        }).toEqual({ playTime: 750, purchaseLocation: "Steam" });
    });

    test("reveals the auxiliary section when a save fails on one of its fields", async ({ page }) => {
        await mockVNDB(page);
        await page.goto("/");
        await seedLibraryItem(page, "v1", { playTime: 150 });
        await page.reload();
        await page.goto("/vn/v1");

        await openAdditionalRecordFields(page);
        await page.locator("#detail-play-time").fill("-1");
        await page.getByTestId("detail-additional-fields").locator("summary").click();
        await expect(page.locator("#detail-play-time")).toBeHidden();

        await page.getByRole("button", { name: "変更を保存", exact: true }).click();
        await expect(page.getByText("プレイ時間は0以上の有限な値で入力してください。", { exact: true })).toBeVisible();
        await expect(page.locator("#detail-play-time")).toBeVisible();
        await expect(page.locator("#detail-play-time")).toHaveValue("-1");
        await expect(page.getByText("未保存の変更", { exact: true })).toBeVisible();
    });

    test("shows the personal record first on desktop and mobile", async ({ browser }) => {
        for (const [width, height, name] of [
            [390, 667, "issue-54-detail-390.png"],
            [1280, 900, "issue-54-detail-1280.png"],
        ] as const) {
            const context = await browser.newContext({ viewport: { width, height } });
            const page = await context.newPage();
            await mockVNDB(page);
            await page.goto("/");
            await seedLibraryItem(page, "v1", {
                status: "playing",
                ownership: "owned",
                score: 85,
                playTime: 750,
                resumeNote: "3日目・地下通路の再開位置",
                notes: "地下通路の分歧で左を選んだ。",
                review: "主线が長いですが終盤の演出は印象に残った。",
                startedOn: "2026-01-05",
                completedOn: "2026-02-06",
            });
            await page.reload();
            await page.goto("/vn/v1");
            await expect(page.locator("#detail-resume-note")).toBeVisible();
            await expect(page.locator("#detail-notes")).toBeVisible();

            const order = await domOrder(page, [
                "#detail-resume-note",
                "[data-testid=\"detail-additional-fields\"]",
                "[data-testid=\"detail-delete-zone\"]",
            ]);
            expect(order).toEqual([...order].sort((a, b) => a - b));

            await captureViewport(page, name);
            await context.close();
        }
    });
});
