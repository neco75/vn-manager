import { expect, test, type Locator, type Page } from "@playwright/test";
import { mockVNDB, readLibraryItem, seedLibraryItem } from "./helpers";

const longNotes = Array.from({ length: 40 }, (_, index) =>
    `Memo paragraph ${index + 1}: a long note used to reach the editor deep in the detail page.`,
).join("\n\n");

const longReview = Array.from({ length: 40 }, (_, index) =>
    `Review paragraph ${index + 1}: a long review used to reach the editor deep in the detail page.`,
).join("\n\n");

async function saveBarLayout(page: Page) {
    const saveButton = page.getByRole("button", { name: "変更を保存", exact: true });
    return page.locator(".sticky").filter({ has: saveButton }).evaluate((saveBar) => {
        const header = document.querySelector("header");
        if (!header) throw new Error("The sticky header is missing");

        const headerRect = header.getBoundingClientRect();
        const saveBarRect = saveBar.getBoundingClientRect();
        return {
            headerBottom: headerRect.bottom,
            saveBarTop: saveBarRect.top,
            saveBarLeft: saveBarRect.left,
            saveBarRight: saveBarRect.right,
            viewportWidth: document.documentElement.clientWidth,
        };
    });
}

async function expectSaveControlReceivesPointer(page: Page) {
    const saveButton = page.getByRole("button", { name: "変更を保存", exact: true });
    const receivesPointer = await saveButton.evaluate((button) => {
        const rect = button.getBoundingClientRect();
        const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return target === button || (target instanceof Node && button.contains(target));
    });

    expect(receivesPointer).toBe(true);
}

async function expectEditorIsNotCovered(page: Page, editor: Locator) {
    const saveButton = page.getByRole("button", { name: "変更を保存", exact: true });
    const saveBarBox = await page.locator(".sticky").filter({ has: saveButton }).boundingBox();
    const headerBox = await page.locator("header").boundingBox();
    const editorBox = await editor.boundingBox();

    if (!saveBarBox || !headerBox || !editorBox) throw new Error("Header, save bar, or editor is not rendered");

    expect(editorBox.y).toBeGreaterThanOrEqual(Math.max(
        headerBox.y + headerBox.height,
        saveBarBox.y + saveBarBox.height,
    ));
}

test("saves a long review below the sticky header across target viewports and 200% zoom equivalent", async ({ browser }) => {
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

            const layout = await saveBarLayout(page);
            expect(layout.saveBarTop).toBeGreaterThanOrEqual(layout.headerBottom);
            expect(layout.saveBarLeft).toBeGreaterThanOrEqual(0);
            expect(layout.saveBarRight).toBeLessThanOrEqual(layout.viewportWidth + 1);
            await expectSaveControlReceivesPointer(page);

            if (width === 390 || width === 1280) {
                await page.screenshot({ path: `test-results/detail-save-bar-${width}.png` });
            }

            await page.getByRole("button", { name: "変更を保存", exact: true }).click();
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

        const saveButton = page.getByRole("button", { name: "変更を保存", exact: true });
        for (let attempt = 0; attempt < 80; attempt += 1) {
            if (await saveButton.evaluate((button) => button === document.activeElement)) break;
            await page.keyboard.press("Shift+Tab");
        }
        await expect(saveButton).toBeFocused();
        await expectSaveControlReceivesPointer(page);

        const layout = await saveBarLayout(page);
        expect(layout.saveBarTop).toBeGreaterThanOrEqual(layout.headerBottom);
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
