import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { mockVNDB, readLibraryItem, seedLibraryItem } from "./helpers";

const longNotes = Array.from({ length: 40 }, (_, index) =>
    `Memo paragraph ${index + 1}: a long note used to reach the editor deep in the detail page.`,
).join("\n\n");

const longReview = Array.from({ length: 40 }, (_, index) =>
    `Review paragraph ${index + 1}: a long review used to reach the editor deep in the detail page.`,
).join("\n\n");

async function saveBarLayout(page: Page) {
    return page.getByTestId("detail-save-bar").evaluate((saveBar) => {
        const header = document.querySelector("header");
        if (!header) throw new Error("The sticky header is missing");

        const headerRect = header.getBoundingClientRect();
        const saveBarRect = saveBar.getBoundingClientRect();
        return {
            headerBottom: header.getClientRects().length === 0 ? 0 : headerRect.bottom,
            saveBarTop: saveBarRect.top,
            saveBarBottom: saveBarRect.bottom,
            saveBarLeft: saveBarRect.left,
            saveBarRight: saveBarRect.right,
            viewportWidth: document.documentElement.clientWidth,
            viewportHeight: document.documentElement.clientHeight,
            position: getComputedStyle(saveBar).position,
            bottom: getComputedStyle(saveBar).bottom,
        };
    });
}

async function expectSaveControlReceivesPointer(page: Page) {
    const saveButton = page.getByRole("button", { name: "記録を保存", exact: true });
    const receivesPointer = await saveButton.evaluate((button) => {
        const rect = button.getBoundingClientRect();
        const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return target === button || (target instanceof Node && button.contains(target));
    });

    expect(receivesPointer).toBe(true);
}

async function expectEditorIsNotCovered(page: Page, editor: Locator) {
    const saveBarBox = await page.getByTestId("detail-save-bar").boundingBox();
    const header = page.locator("header");
    const headerVisible = await header.isVisible();
    const headerBox = headerVisible ? await header.boundingBox() : null;
    const editorBox = await editor.boundingBox();
    const expectedHeaderVisible = (page.viewportSize()?.width ?? 0) < 1024;

    expect(headerVisible).toBe(expectedHeaderVisible);
    if (!saveBarBox || !editorBox || (headerVisible && !headerBox)) {
        throw new Error("Save bar, expected header area, or editor is not rendered");
    }

    const editorBottom = editorBox.y + editorBox.height;
    const overlapsHeader = Boolean(headerBox)
        && editorBox.y < headerBox!.y + headerBox!.height
        && editorBottom > headerBox!.y;
    const overlapsSaveBar = editorBox.y < saveBarBox.y + saveBarBox.height
        && editorBottom > saveBarBox.y;
    expect(overlapsHeader).toBe(false);
    expect(overlapsSaveBar, JSON.stringify({ editorBox, saveBarBox })).toBe(false);
}

test("saves a long review with a visible save action across target viewports and a 200% zoom equivalent", async ({ browser }) => {
    test.setTimeout(60_000);

    // A 640px CSS viewport is the layout width of a 1280px desktop viewport at 200% browser zoom.
    for (const width of [320, 390, 640, 768, 1024, 1280]) {
        const height = width === 390 ? 667 : width === 640 ? 450 : 900;
        const context = await browser.newContext({ viewport: { width, height } });

        try {
            const page = await context.newPage();
            await mockVNDB(page);
            await page.goto("/");
            await seedLibraryItem(page, "v1", { notes: longNotes, review: longReview });
            await page.reload();
            await page.goto("/vn/v1");

            const review = page.getByRole("textbox", { name: "感想・レビュー" });
            await expect(review).toHaveValue(longReview);
            await review.scrollIntoViewIfNeeded();
            await expectEditorIsNotCovered(page, review);
            const updatedReview = `${longReview}\n\nEdited and saved at ${width}px.`;
            await review.fill(updatedReview);
            await review.scrollIntoViewIfNeeded();
            await expectEditorIsNotCovered(page, review);

            const saveButton = page.getByRole("button", { name: "記録を保存", exact: true });
            await saveButton.scrollIntoViewIfNeeded();
            await saveButton.focus();
            const layout = await saveBarLayout(page);
            expect(layout.saveBarLeft).toBeGreaterThanOrEqual(0);
            expect(layout.saveBarRight).toBeLessThanOrEqual(layout.viewportWidth + 1);
            expect(layout.saveBarBottom).toBeLessThanOrEqual(layout.viewportHeight + 1);
            expect(layout.position).toBe(width < 1024 ? "fixed" : "static");
            if (width < 1024) {
                expect(layout.viewportHeight - layout.saveBarBottom).toBeLessThan(32);
                expect(Number.parseFloat(layout.bottom)).toBeGreaterThanOrEqual(0);
            }
            await expectSaveControlReceivesPointer(page);

            if (width === 390 || width === 1280) {
                await page.screenshot({ path: `test-results/detail-save-bar-${width}.png` });
            }

            await saveButton.click();
            await expect(page.getByText("本記録は保存済み", { exact: true })).toBeVisible();
            await expect.poll(() => readLibraryItem(page, "v1")).toMatchObject({
                notes: longNotes,
                review: updatedReview,
            });

            if (width < 1024) {
                await page.getByRole("button", { name: "メニュー", exact: true }).click();
                await expect(page.getByRole("dialog")).toBeVisible();
                await page.keyboard.press("Escape");
                await expect(page.getByRole("dialog")).not.toBeVisible();
            } else {
                await page.getByRole("link", { name: "ライブラリ", exact: true }).click();
                await expect(page).toHaveURL(/\/$/);
            }
        } finally {
            await context.close();
        }
    }
});

test("keyboard focus can reach and activate save while editing a long review", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 667 } });

    try {
        const page = await context.newPage();
        await mockVNDB(page);
        await page.goto("/");
        await seedLibraryItem(page, "v1", { notes: longNotes, review: longReview });
        await page.reload();
        await page.goto("/vn/v1");

        const review = page.getByRole("textbox", { name: "感想・レビュー" });
        const updatedReview = `${longReview}\n\nSaved with the keyboard.`;
        await review.scrollIntoViewIfNeeded();
        await expectEditorIsNotCovered(page, review);
        await review.fill(updatedReview);
        await page.setViewportSize({ width: 390, height: 390 });
        await review.scrollIntoViewIfNeeded();
        await expectEditorIsNotCovered(page, review);

        const saveButton = page.getByRole("button", { name: "記録を保存", exact: true });
        for (let attempt = 0; attempt < 80; attempt += 1) {
            if (await saveButton.evaluate((button) => button === document.activeElement)) break;
            await page.keyboard.press("Tab");
        }
        await expect(saveButton).toBeFocused();
        await expectSaveControlReceivesPointer(page);

        const layout = await saveBarLayout(page);
        expect(layout.position).toBe("fixed");
        expect(layout.viewportHeight - layout.saveBarBottom).toBeLessThan(32);
        await page.keyboard.press("Enter");
        await expect(page.getByText("本記録は保存済み", { exact: true })).toBeVisible();
        await expect.poll(() => readLibraryItem(page, "v1")).toMatchObject({
            notes: longNotes,
            review: updatedReview,
        });
    } finally {
        await context.close();
    }
});

test("shows a bottom save bar only while the mobile record is unsaved and captures both layouts", async ({ browser }) => {
    for (const [width, height, screenshot] of [
        [1440, 1000, "v2-08-save-bar-1440x1000.png"],
        [390, 844, "v2-08-save-bar-390x844.png"],
        [390, 667, "v2-08-save-bar-390x667.png"],
    ] as const) {
        const context = await browser.newContext({ viewport: { width, height } });
        try {
            const page = await context.newPage();
            await mockVNDB(page);
            await page.goto("/");
            await seedLibraryItem(page, "v1", { review: "Saved review" });
            await page.reload();
            await page.goto("/vn/v1");

            const saveBar = page.getByTestId("detail-save-bar");
            expect(await saveBar.evaluate((element) => getComputedStyle(element).position)).toBe("static");
            await page.getByRole("textbox", { name: "感想・レビュー", exact: true }).fill("未保存の変更を残して表示");
            const saveButton = page.getByRole("button", { name: "記録を保存", exact: true });
            await saveButton.scrollIntoViewIfNeeded();
            await saveButton.focus();
            await expect(saveButton).toBeVisible();
            await expect(saveBar.getByText("未保存の変更", { exact: true })).toBeVisible();
            expect(await saveBar.evaluate((element) => getComputedStyle(element).position))
                .toBe(width < 1024 ? "fixed" : "static");

            const path = join(process.cwd(), "e2e", "screenshots", screenshot);
            await mkdir(dirname(path), { recursive: true });
            await page.screenshot({ path, animations: "disabled" });
        } finally {
            await context.close();
        }
    }
});

test("keeps edited values and delete controls reachable when a record save fails", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 667 });
    await mockVNDB(page);
    await page.goto("/");
    await seedLibraryItem(page, "v1", { review: "Saved review" });
    await page.reload();
    await page.goto("/vn/v1");
    await expect(page.getByRole("heading", { name: "Fixture VN One", exact: true })).toBeVisible();

    await page.evaluate(() => {
        const testWindow = window as Window & { __failNextLibraryWrite?: boolean };
        testWindow.__failNextLibraryWrite = false;
        const originalPut = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (...args: unknown[]) {
            if (this.name === "library" && testWindow.__failNextLibraryWrite) {
                testWindow.__failNextLibraryWrite = false;
                throw new DOMException("fixture quota exceeded", "QuotaExceededError");
            }
            return Reflect.apply(originalPut, this, args);
        };
    });

    const review = page.getByRole("textbox", { name: "感想・レビュー", exact: true });
    const retryValue = "Failure keeps this review for retry";
    await review.fill(retryValue);
    await page.evaluate(() => {
        (window as Window & { __failNextLibraryWrite?: boolean }).__failNextLibraryWrite = true;
    });

    const saveBar = page.getByTestId("detail-save-bar");
    const saveButton = page.getByRole("button", { name: "記録を保存", exact: true });
    await saveButton.click();
    const saveFeedback = saveBar.getByTestId("detail-save-feedback");
    await expect(saveFeedback).toHaveText("保存に失敗しました。入力内容を残したまま再試行できます。");
    await expect(review).toHaveValue(retryValue);
    await expect.poll(async () => (await readLibraryItem(page, "v1"))?.review).toBe("Saved review");
    await expect(saveButton).toBeEnabled();

    const deleteButton = page.getByTestId("detail-delete-zone").getByRole("button", { name: "ライブラリから削除" });
    await saveButton.focus();
    for (let attempt = 0; attempt < 80; attempt += 1) {
        if (await deleteButton.evaluate((button) => button === document.activeElement)) break;
        await page.keyboard.press("Tab");
    }
    await expect(deleteButton).toBeFocused();
    const layout = await page.evaluate(() => {
        const deleteButton = document.querySelector('[data-testid="detail-delete-zone"] button');
        const saveBar = document.querySelector('[data-testid="detail-save-bar"]');
        if (!deleteButton || !saveBar) throw new Error("Delete control or save bar is not rendered");
        const deleteBox = deleteButton.getBoundingClientRect();
        const saveBarBox = saveBar.getBoundingClientRect();
        return {
            deleteBottom: deleteBox.bottom,
            saveBarTop: saveBarBox.top,
            viewportBottom: document.documentElement.clientHeight,
            saveBarPosition: getComputedStyle(saveBar).position,
        };
    });
    expect(layout.saveBarPosition).toBe("fixed");
    expect(layout.deleteBottom).toBeLessThanOrEqual(layout.saveBarTop);
    expect(layout.deleteBottom).toBeLessThanOrEqual(layout.viewportBottom);

    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Fixture VN One");
    await dialog.getByRole("button", { name: "キャンセル", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(review).toHaveValue(retryValue);
    await expect(saveFeedback).toBeVisible();

    await saveButton.click();
    await expect(saveFeedback).toBeHidden();
    await expect(page.getByText("本記録は保存済み", { exact: true })).toBeVisible();
    await expect.poll(async () => (await readLibraryItem(page, "v1"))?.review).toBe(retryValue);
});
