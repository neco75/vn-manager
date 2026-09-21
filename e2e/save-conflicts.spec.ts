import { expect, test } from "@playwright/test";
import {
    holdVNDBIdRequest,
    mockVNDB,
    readLibraryItem,
    seedLibraryItem,
} from "./helpers";

const saveConflictMessage = "別のタブで記録が更新されたため保存できませんでした。保存済み記録を確認してから再試行してください。入力内容と下書きは残っています。";

test.describe("concurrent library saves", () => {
    test("keeps the newer personal record when metadata refresh is delayed", async ({ page, context }) => {
        await mockVNDB(page);
        await page.goto("/stats");
        await seedLibraryItem(page, "v1", { notes: "before refresh" });
        await page.reload();

        const heldRequest = await holdVNDBIdRequest(page, "v1");
        await page.getByRole("button", { name: "NSFW情報を更新", exact: true }).click();
        await heldRequest.requestStarted;

        const editorPage = await context.newPage();
        await mockVNDB(editorPage);
        await editorPage.goto("/vn/v1");
        const notes = editorPage.getByRole("textbox", { name: "メモ (非公開)" });
        await expect(notes).toHaveValue("before refresh");
        await notes.fill("saved while refresh is waiting");
        await editorPage.getByRole("button", { name: "変更を保存", exact: true }).click();
        await expect(editorPage.getByText("本記録は保存済み", { exact: true })).toBeVisible();

        heldRequest.releaseRequest();
        await expect(page.getByText("1件のNSFW情報を更新しました", { exact: true })).toBeVisible();
        await expect.poll(async () => (await readLibraryItem(page, "v1"))?.notes)
            .toBe("saved while refresh is waiting");
        await editorPage.close();
    });

    test("does not resurrect a record deleted while metadata refresh is delayed", async ({ page, context }) => {
        await mockVNDB(page);
        await page.goto("/stats");
        await seedLibraryItem(page, "v1");
        await page.reload();

        const heldRequest = await holdVNDBIdRequest(page, "v1");
        await page.getByRole("button", { name: "NSFW情報を更新", exact: true }).click();
        await heldRequest.requestStarted;

        const editorPage = await context.newPage();
        await mockVNDB(editorPage);
        await editorPage.goto("/vn/v1");
        editorPage.once("dialog", (dialog) => void dialog.accept());
        await editorPage.getByRole("button", { name: "削除", exact: true }).click();
        await expect(editorPage.getByText("削除しました", { exact: true })).toBeVisible();
        await expect.poll(async () => readLibraryItem(page, "v1")).toBeUndefined();

        heldRequest.releaseRequest();
        await expect(page.getByText("0件のNSFW情報を更新しました", { exact: true })).toBeVisible();
        await expect(page.getByText("まだ記録がありません。", { exact: true })).toBeVisible();
        await expect.poll(async () => readLibraryItem(page, "v1")).toBeUndefined();
        await editorPage.close();
    });

    test("rejects a stale tab without overwriting its input or draft", async ({ page, context }) => {
        await mockVNDB(page);
        await page.goto("/");
        await seedLibraryItem(page, "v1", { notes: "original record" });
        await page.reload();
        await page.goto("/vn/v1");

        const editorPage = await context.newPage();
        await mockVNDB(editorPage);
        await editorPage.goto("/vn/v1");

        const staleNotes = page.getByRole("textbox", { name: "メモ (非公開)" });
        const newerNotes = editorPage.getByRole("textbox", { name: "メモ (非公開)" });
        await staleNotes.fill("stale tab input");
        await expect(page.getByText("下書き保存済み・記録には未反映", { exact: true })).toBeVisible();
        await newerNotes.fill("newer tab record");
        await editorPage.getByRole("button", { name: "変更を保存", exact: true }).click();
        await expect(editorPage.getByText("本記録は保存済み", { exact: true })).toBeVisible();

        await page.getByRole("button", { name: "変更を保存", exact: true }).click();
        await expect(page.getByText(saveConflictMessage, { exact: true }).last()).toBeVisible();
        await expect(staleNotes).toHaveValue("stale tab input");
        await expect.poll(async () => (await readLibraryItem(page, "v1"))?.notes)
            .toBe("newer tab record");
        await editorPage.close();
    });

    test("does not overwrite the first record when two tabs add the same VN", async ({ page, context }) => {
        await mockVNDB(page);
        await page.goto("/vn/v1");
        const secondPage = await context.newPage();
        await mockVNDB(secondPage);
        await secondPage.goto("/vn/v1");

        const firstNotes = page.getByRole("textbox", { name: "メモ (非公開)" });
        const secondNotes = secondPage.getByRole("textbox", { name: "メモ (非公開)" });
        await firstNotes.fill("first tab record");
        await secondNotes.fill("second tab record");

        await Promise.all([
            page.getByRole("button", { name: "ライブラリに追加", exact: true }).click(),
            secondPage.getByRole("button", { name: "ライブラリに追加", exact: true }).click(),
        ]);

        await expect.poll(async () => (await readLibraryItem(page, "v1"))?.notes)
            .toMatch(/^(first|second) tab record$/);
        const firstConflict = page.getByText(saveConflictMessage, { exact: true });
        const secondConflict = secondPage.getByText(saveConflictMessage, { exact: true });
        await expect.poll(async () => (await firstConflict.count()) + (await secondConflict.count()))
            .toBeGreaterThan(0);
        expect((await firstConflict.count()) > 0 || (await secondConflict.count()) > 0).toBe(true);
        await expect(firstNotes).toHaveValue(/tab record/);
        await expect(secondNotes).toHaveValue(/tab record/);
        await secondPage.close();
    });
});
