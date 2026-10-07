import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import fixture from "./fixtures/vndb.json";
import {
    mockVNDB,
    openAdditionalRecordFields,
    readLibraryItem,
    seedLibraryItem,
    seedPurchaseSources,
} from "./helpers";
import type { VN } from "@/types/vndb";

const workTitle = "Fixture VN One";
const saveBarSelector = '[data-testid="detail-save-bar"]';

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
    return page.locator(saveBarSelector).filter({ has: page.getByRole("button", { name: "記録を保存", exact: true }) });
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
        await expect(page.locator("#detail-review")).toBeVisible();

        const box = await resumeNote.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.y).toBeGreaterThanOrEqual(0);
        expect(box!.y + box!.height).toBeLessThanOrEqual(667);

        await expect(page.getByTestId("detail-notes-section").locator("summary")).toBeVisible();
        await expect(page.locator("#detail-notes")).toBeHidden();
        const order = await domOrder(page, [
            "#detail-status",
            "#detail-score",
            "#detail-play-time",
            "#detail-resume-note",
            "#detail-review",
            "[data-testid=\"detail-notes-section\"]",
            "[data-testid=\"detail-record-details\"]",
        ]);
        expect(order.every((index) => index >= 0), `missing record selector: ${JSON.stringify(order)}`).toBe(true);
        expect(order).toEqual([...order].sort((a, b) => a - b));

        await resumeNote.fill("3日目・地下通路から再開");
        await expect(page.getByText("未保存の変更", { exact: true })).toBeVisible();
        await page.getByRole("button", { name: "記録を保存", exact: true }).click();
        await expect(page.getByText("本記録は保存済み", { exact: true })).toBeVisible();
        await expect.poll(async () => (await readLibraryItem(page, "v1"))?.resumeNote)
            .toBe("3日目・地下通路から再開");
    });

    test("keeps the delete confirmation and record after failure so deletion can be retried", async ({ page }) => {
        await mockVNDB(page);
        await page.goto("/");
        await seedLibraryItem(page, "v1", { notes: "saved memo" });
        await page.reload();
        await page.goto("/vn/v1");

        await page.evaluate(() => {
            const testWindow = window as Window & { __failNextLibraryDelete?: boolean };
            testWindow.__failNextLibraryDelete = false;
            const originalDelete = IDBObjectStore.prototype.delete;
            IDBObjectStore.prototype.delete = function (...args: unknown[]) {
                if (this.name === "library" && testWindow.__failNextLibraryDelete) {
                    testWindow.__failNextLibraryDelete = false;
                    throw new DOMException("fixture delete failed", "QuotaExceededError");
                }
                return Reflect.apply(originalDelete, this, args);
            };
        });

        await page.getByRole("button", { name: "ライブラリから削除", exact: true }).click();
        const dialog = page.getByRole("dialog");
        await page.evaluate(() => {
            (window as Window & { __failNextLibraryDelete?: boolean }).__failNextLibraryDelete = true;
        });
        await dialog.getByRole("button", { name: "この記録を削除", exact: true }).click();

        await expect(dialog.getByTestId("detail-delete-feedback")).toHaveText("削除に失敗しました。もう一度お試しください。");
        await expect(dialog).toBeVisible();
        await expect.poll(async () => (await readLibraryItem(page, "v1"))?.notes).toBe("saved memo");

        await dialog.getByRole("button", { name: "この記録を削除", exact: true }).click();
        await expect(dialog).not.toBeVisible();
        await expect.poll(async () => readLibraryItem(page, "v1")).toBeUndefined();
    });

    test("keeps the external information folded so it does not push the record down", async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 667 });
        await mockVNDB(page);
        await page.goto("/");
        await seedLibraryItem(page, "v1", { notes: "saved memo" });
        await page.reload();
        await page.goto("/vn/v1");

        const titleInformation = page.getByRole("button", { name: "作品情報を見る", exact: true });
        await expect(titleInformation).toHaveAttribute("aria-expanded", "false");
        await expect(page.getByText("Visible intro", { exact: false })).not.toBeAttached();
        await expect(page.getByText("hidden ending", { exact: true })).not.toBeAttached();

        await expect(page.getByTestId("detail-notes-section").locator("summary")).toBeVisible();
        await expect(page.locator("#detail-notes")).toBeHidden();
        const order = await domOrder(page, [
            "#detail-resume-note",
            "[data-testid=\"detail-notes-section\"]",
            "[data-testid=\"detail-record-details\"]",
            "[data-testid=\"detail-title-information\"]",
        ]);
        expect(order.every((index) => index >= 0)).toBe(true);
        expect(order[0]).toBeLessThan(order[1]);
        expect(order[1]).toBeLessThan(order[2]);

        await titleInformation.click();
        const synopsis = page.getByRole("button", { name: "あらすじ", exact: true });
        await expect(synopsis).toHaveAttribute("aria-expanded", "false");
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

        await page.getByTestId("detail-notes-section").locator("summary").click();
        const notes = page.getByRole("textbox", { name: "メモ（自分用）", exact: true });
        await notes.fill("未保存値は削除確認のキャンセル後も残る");

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
        await expect(notes).toHaveValue("未保存値は削除確認のキャンセル後も残る");
        await expect(page.getByText("未保存の変更", { exact: true })).toBeVisible();
        expect((await readLibraryItem(page, "v1"))?.notes).toBe("saved memo");

        await removeButton.click();
        await page.getByRole("dialog").getByRole("button", { name: "この記録を削除", exact: true }).click();
        await expect(page.getByText("削除しました", { exact: true })).toBeVisible();
        await expect(page.getByRole("dialog")).not.toBeVisible();
        await expect(page.getByTestId("detail-delete-zone")).not.toBeVisible();
        await expect(page.getByText("ライブラリには未登録", { exact: true })).toBeVisible();
        await expect.poll(async () => readLibraryItem(page, "v1")).toBeUndefined();
    });

    test("keeps primary and folded record fields separate through save and reload", async ({ page }) => {
        await mockVNDB(page);
        await page.goto("/");
        await seedLibraryItem(page, "v1", { status: "playing", score: 0, playTime: 60 });
        await seedPurchaseSources(page, ["Steam"]);
        await page.reload();
        await page.goto("/vn/v1");

        const details = page.getByTestId("detail-record-details");
        const notesSection = page.getByTestId("detail-notes-section");
        const status = page.getByRole("combobox", { name: "ステータス", exact: true });
        const score = page.getByRole("spinbutton", { name: "スコア", exact: true });
        const playTime = page.getByRole("spinbutton", { name: "プレイ時間", exact: true });
        const resumeNote = page.getByRole("textbox", { name: "再開メモ", exact: true });
        const review = page.getByRole("textbox", { name: "感想・レビュー", exact: true });
        await expect(details).not.toHaveAttribute("open", "");
        await expect(notesSection).not.toHaveAttribute("open", "");
        await expect(score).toBeVisible();
        await expect(score).toHaveValue("0");
        await expect(playTime).toHaveValue("1");
        await expect(page.locator("#detail-ownership")).toBeHidden();
        await openAdditionalRecordFields(page);
        await expect(page.getByTestId("detail-legacy-score-note")).toBeVisible();
        await expect(page.getByRole("option")).toHaveCount(0);
        await status.click();
        await expect(page.getByRole("option")).toHaveCount(6);
        await page.getByRole("option", { name: "クリア済み", exact: true }).click();

        await score.fill("100");
        await expect(page.getByTestId("detail-legacy-score-note")).not.toBeAttached();
        await playTime.fill("12.5");
        await resumeNote.fill("3日目・地下通路から再開");
        const longReview = "review without an added length cap ".repeat(40);
        expect(longReview.length).toBeGreaterThan(1000);
        await review.fill(longReview);

        await notesSection.locator("summary").click();
        const notes = page.getByRole("textbox", { name: "メモ（自分用）", exact: true });
        await notes.fill("自分用のメモ。感想や再開位置とは別に保存。");
        await notesSection.locator("summary").click();
        await expect(notes).toBeHidden();
        await notesSection.locator("summary").click();
        await expect(notes).toHaveValue("自分用のメモ。感想や再開位置とは別に保存。");
        await notesSection.locator("summary").click();

        const ownership = page.getByRole("combobox", { name: "所有状況", exact: true });
        await ownership.click();
        await expect(page.getByRole("option")).toHaveCount(3);
        await page.getByRole("option", { name: "所有済み", exact: true }).click();
        await page.locator("#detail-started-on").fill("2026-01-05");
        await page.locator("#detail-completed-on").fill("2026-02-06");
        await page.locator("#detail-last-played-on").fill("2026-03-07");
        await page.getByRole("combobox", { name: "購入先を選択" }).click();
        await page.getByRole("option", { name: "Steam", exact: true }).click();
        await details.locator("summary").click();
        await expect(ownership).toBeHidden();
        await details.locator("summary").click();
        await expect(ownership).toContainText("所有済み");
        await expect(page.locator("#detail-started-on")).toHaveValue("2026-01-05");
        await expect(page.locator("#detail-completed-on")).toHaveValue("2026-02-06");
        await expect(page.locator("#detail-last-played-on")).toHaveValue("2026-03-07");
        await expect(page.getByRole("combobox", { name: "購入先を選択" })).toContainText("Steam");

        await page.getByRole("button", { name: "記録を保存", exact: true }).click();
        await expect(page.getByText("本記録は保存済み", { exact: true })).toBeVisible();
        await expect.poll(async () => await readLibraryItem(page, "v1")).toMatchObject({
            status: "completed",
            ownership: "owned",
            score: 100,
            playTime: 750,
            notes: "自分用のメモ。感想や再開位置とは別に保存。",
            review: longReview,
            resumeNote: "3日目・地下通路から再開",
            startedOn: "2026-01-05",
            completedOn: "2026-02-06",
            lastPlayedOn: "2026-03-07",
            purchaseLocation: "Steam",
        });

        await page.reload();
        await openAdditionalRecordFields(page);
        await expect(score).toHaveValue("100");
        await expect(playTime).toHaveValue("12.5");
        await expect(resumeNote).toHaveValue("3日目・地下通路から再開");
        await expect(review).toHaveValue(longReview);
        await expect(page.locator("#detail-started-on")).toHaveValue("2026-01-05");
        await expect(page.locator("#detail-completed-on")).toHaveValue("2026-02-06");
        await expect(page.locator("#detail-last-played-on")).toHaveValue("2026-03-07");
        await expect(ownership).toContainText("所有済み");
        await expect(page.getByRole("combobox", { name: "購入先を選択" })).toContainText("Steam");
        await expect(notesSection).not.toHaveAttribute("open", "");
        await notesSection.locator("summary").click();
        await expect(notes).toHaveValue("自分用のメモ。感想や再開位置とは別に保存。");

        await page.locator("#detail-score").fill("0");
        await page.getByRole("button", { name: "記録を保存", exact: true }).click();
        await expect.poll(async () => (await readLibraryItem(page, "v1"))?.score).toBe(0);
        await page.reload();
        await expect(score).toHaveValue("0");
        await page.getByRole("button", { name: "未評価に戻す", exact: true }).click();
        await page.getByRole("button", { name: "記録を保存", exact: true }).click();
        await expect.poll(async () => (await readLibraryItem(page, "v1"))?.score).toBeNull();
        await page.reload();
        await expect(score).toHaveValue("");
    });

    test("keeps primary validation visible and reveals record details for a date-order error", async ({ page }) => {
        await mockVNDB(page);
        await page.goto("/");
        await seedLibraryItem(page, "v1", { playTime: 150 });
        await page.reload();
        await page.goto("/vn/v1");

        await page.locator("#detail-play-time").fill("-1");
        await page.getByRole("button", { name: "記録を保存", exact: true }).click();
        await expect(page.getByText("プレイ時間は0以上の有限な値で入力してください。", { exact: true })).toBeVisible();
        await expect(page.locator("#detail-play-time")).toBeVisible();
        await expect(page.locator("#detail-play-time")).toHaveValue("-1");
        await expect(page.getByText("未保存の変更", { exact: true })).toBeVisible();

        await page.locator("#detail-play-time").fill("1");
        await openAdditionalRecordFields(page);
        await page.locator("#detail-started-on").fill("2026-03-07");
        await page.locator("#detail-completed-on").fill("2026-02-06");
        await page.getByTestId("detail-record-details").locator("summary").click();
        await page.getByRole("button", { name: "記録を保存", exact: true }).click();
        await expect(page.getByText("クリア日は開始日より前にできません。", { exact: true })).toBeVisible();
        await expect(page.locator("#detail-started-on")).toBeVisible();
        await expect(page.locator("#detail-started-on")).toHaveValue("2026-03-07");
        await expect(page.locator("#detail-completed-on")).toHaveValue("2026-02-06");
    });

    test("rejects a restored resume note longer than 200 characters without replacing saved data", async ({ page }) => {
        await mockVNDB(page);
        await page.goto("/");
        await seedLibraryItem(page, "v1", { resumeNote: "saved resume note" });
        await page.reload();

        const invalidResumeNote = "r".repeat(201);
        await page.evaluate((resumeNote) => {
            localStorage.setItem("vn-manager-detail-draft-v1:v1", JSON.stringify({
                version: 1,
                vnId: "v1",
                baseUpdatedAt: 1,
                updatedAt: 2,
                values: {
                    status: "playing",
                    ownership: "unknown",
                    score: null,
                    notes: "draft memo",
                    review: "draft review",
                    playTime: 0,
                    purchaseLocation: "",
                    startedOn: "",
                    completedOn: "",
                    lastPlayedOn: "",
                    resumeNote,
                },
            }));
        }, invalidResumeNote);
        await page.goto("/vn/v1");

        const resumeNote = page.getByRole("textbox", { name: "再開メモ", exact: true });
        await expect(page.getByText("この作品に未反映の下書きがあります。復元しますか？", { exact: true })).toBeVisible();
        await expect(resumeNote).toBeDisabled();
        await page.getByRole("button", { name: "下書きを復元" }).click();
        await expect(resumeNote).toHaveAttribute("maxLength", "200");
        await expect(resumeNote).toHaveValue(invalidResumeNote);

        await page.getByRole("button", { name: "記録を保存", exact: true }).click();
        await expect(page.getByText("再開メモは200文字以内で入力してください。", { exact: true })).toBeVisible();
        await expect.poll(async () => (await readLibraryItem(page, "v1"))?.resumeNote).toBe("saved resume note");
    });

    test("places the cover and record as a readable desktop/mobile detail layout", async ({ browser }) => {
        for (const [width, height, name] of [
            [390, 844, "v2-07-record-390x844.png"],
            [390, 667, "v2-07-record-390x667.png"],
            [768, 900, null],
            [1023, 900, null],
            [1024, 900, "v2-07-record-1024x900.png"],
            [1280, 900, null],
            [1440, 1000, "v2-07-record-1440x1000.png"],
        ] as const) {
            const context = await browser.newContext({ viewport: { width, height } });
            try {
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
                await expect(page.getByRole("heading", { name: "Fixture VN One", exact: true })).toBeVisible();
                await expect(page.locator("#detail-resume-note")).toBeVisible();
                await expect(page.getByTestId("detail-notes-section").locator("summary")).toBeVisible();
                await expect(page.locator("#detail-notes")).toBeHidden();
                await expect(page.getByTestId("detail-title-information").getByRole("button"))
                    .toHaveAttribute("aria-expanded", "false");
                await expect(page.getByText("Fixture Works", { exact: true })).toBeVisible();
                await expectNoHorizontalOverflow(page);
                expect(await page.locator("main nav").count()).toBe(0);
                if (width < 1024) {
                    await expect(page.locator("header")).toBeVisible();
                } else {
                    await expect(page.locator("header")).not.toBeVisible();
                }

                const [cover, title, record, titleInformation] = await Promise.all([
                    page.getByTestId("detail-cover").boundingBox(),
                    page.getByRole("heading", { name: "Fixture VN One", exact: true }).boundingBox(),
                    page.getByTestId("detail-record").boundingBox(),
                    page.getByTestId("detail-title-information").boundingBox(),
                ]);
                expect(cover).not.toBeNull();
                expect(title).not.toBeNull();
                expect(record).not.toBeNull();
                expect(titleInformation).not.toBeNull();
                if (width >= 1024) {
                    expect(cover!.width).toBeGreaterThanOrEqual(220);
                    expect(cover!.width).toBeLessThanOrEqual(360);
                    expect(cover!.height).toBeLessThanOrEqual(560);
                    expect(title!.x).toBeGreaterThan(cover!.x + cover!.width);
                    expect(record!.x).toBeGreaterThan(cover!.x + cover!.width);
                    expect(Math.abs(title!.y - cover!.y)).toBeLessThanOrEqual(4);
                    expect(record!.y).toBeLessThan(cover!.y + cover!.height);
                    expect(titleInformation!.x).toBeLessThan(record!.x);
                    expect(titleInformation!.width).toBeLessThanOrEqual(cover!.width + 1);
                    expect(titleInformation!.y).toBeGreaterThanOrEqual(cover!.y + cover!.height - 1);
                } else {
                    expect(cover!.width).toBe(80);
                    expect(cover!.height).toBe(120);
                    expect(title!.x).toBeGreaterThanOrEqual(cover!.x + cover!.width);
                    expect(record!.width).toBeGreaterThan(cover!.width * 2);
                    expect(titleInformation!.y).toBeGreaterThanOrEqual(record!.y + record!.height - 1);
                }

                const order = await domOrder(page, [
                    "#detail-status",
                    "#detail-score",
                    "#detail-play-time",
                    "#detail-resume-note",
                    "#detail-review",
                    "[data-testid=\"detail-notes-section\"]",
                    "[data-testid=\"detail-record-details\"]",
                    "[data-testid=\"detail-title-information\"]",
                    "[data-testid=\"detail-delete-zone\"]",
                ]);
                expect(order).toEqual([...order].sort((a, b) => a - b));

                if (name) await captureViewport(page, name);
            } finally {
                await context.close();
            }
        }
    });

    test("keeps a full saved title and record available when the VNDB refresh fails", async ({ page }) => {
        const longTitle = "A very long visual novel title that remains fully readable on this detail page";
        const localVN = structuredClone((fixture.vns as unknown as Record<string, VN>).v1);
        localVN.title = longTitle;
        await page.setViewportSize({ width: 390, height: 844 });
        await mockVNDB(page, { detailError: true });
        await page.goto("/");
        await seedLibraryItem(page, "v1", {
            vn: localVN,
            status: "playing",
            resumeNote: "保存済みの再開位置",
        });
        await page.reload();
        await page.goto("/vn/v1");

        await expect(page.getByRole("heading", { name: longTitle, exact: true })).toBeVisible();
        await expect(page.getByText("VNDBから最新情報を取得できませんでした。", { exact: true })).toBeVisible();
        await expect(page.locator("#detail-resume-note")).toHaveValue("保存済みの再開位置");
        await expect(page.getByRole("combobox", { name: "ステータス" })).toContainText("プレイ中");
        await expectNoHorizontalOverflow(page);
    });
});
