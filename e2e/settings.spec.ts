import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { fingerprintBackupDocument, type BackupDocument } from "@/lib/backup";
import { readLibraryItem, readPurchaseSourceNames, seedLibraryItem, seedPurchaseSources } from "./helpers";

async function downloadBackup(page: Page, language: "ja" | "en" = "ja") {
    const buttonName = language === "ja"
        ? "バックアップをダウンロード (JSON)"
        : "Download Backup (JSON)";
    const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: buttonName, exact: true }).click(),
    ]);
    const path = await download.path();
    if (!path) throw new Error("Expected the backup download to have a file path");
    const data = JSON.parse(await readFile(path, "utf8")) as BackupDocument;
    return { download, data };
}

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

    test("preserves the first-export message and labels a legacy export as untracked in Japanese and English", async ({ page }) => {
        const region = page.getByRole("region", { name: "データとバックアップ" });
        await page.goto("/settings");
        await expect(region.getByText("まだバックアップをエクスポートしていません。", { exact: true })).toBeVisible();
        await expect(region.getByText("以前のバックアップ内容は確認できません。エクスポートすると、以後の変更を確認できます。", { exact: true })).toHaveCount(0);

        const previousExportAt = "2025-01-02T03:04:05.000Z";
        await page.evaluate((exportAt) => {
            localStorage.setItem("vn-manager-last-export-at", exportAt);
        }, previousExportAt);
        await page.reload();

        await expect(region.getByText("以前のバックアップ内容は確認できません。エクスポートすると、以後の変更を確認できます。", { exact: true })).toBeVisible();
        await expect(region.getByText("前回のバックアップ以降にデータが変更されています。最新状態を保存するには、もう一度エクスポートしてください。", { exact: true })).toHaveCount(0);
        await page.getByRole("button", { name: "英語", exact: true }).click();
        await expect(page.getByText("The previous backup contents can't be verified. Export a backup to track changes from now on.", { exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Japanese", exact: true }).click();
        await expect(page.getByText("以前のバックアップ内容は確認できません。エクスポートすると、以後の変更を確認できます。", { exact: true })).toBeVisible();

        const { data } = await downloadBackup(page, "ja");
        const savedFingerprint = await fingerprintBackupDocument(data);
        await expect(page.evaluate(() => localStorage.getItem("vn-manager-last-export-fingerprint"))).resolves.toBe(savedFingerprint);
        await expect(page.getByText("以前のバックアップ内容は確認できません。エクスポートすると、以後の変更を確認できます。", { exact: true })).toHaveCount(0);

        await page.getByRole("button", { name: "英語", exact: true }).click();
        await expect(page.getByText("Your data has changed since the last backup. Export again to save the latest version.", { exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Japanese", exact: true }).click();
        await expect(page.getByText("前回のバックアップ以降にデータが変更されています。最新状態を保存するには、もう一度エクスポートしてください。", { exact: true })).toHaveCount(0);
    });

    test("detects saved library, purchase-source, and setting changes but ignores detail drafts", async ({ page }) => {
        await page.goto("/");
        await seedLibraryItem(page, "v1", { score: 80, notes: "saved memo" });
        await seedPurchaseSources(page, ["Steam"]);
        await page.reload();
        await page.goto("/settings");

        const changedMessage = "前回のバックアップ以降にデータが変更されています。最新状態を保存するには、もう一度エクスポートしてください。";
        await downloadBackup(page);
        const savedFingerprint = await page.evaluate(() => localStorage.getItem("vn-manager-last-export-fingerprint"));
        expect(savedFingerprint).toMatch(/^[a-f0-9]{64}$/);
        await expect(page.getByText(changedMessage, { exact: true })).toHaveCount(0);

        await page.goto("/vn/v1");
        await expect(page.locator("#detail-score")).toHaveValue("80");
        await page.locator("#detail-score").fill("81");
        await page.getByRole("button", { name: "記録を保存", exact: true }).click();
        await expect(page.getByText("本記録は保存済み", { exact: true })).toBeVisible();
        await page.goto("/settings");
        await expect(page.getByText(changedMessage, { exact: true })).toBeVisible();

        await downloadBackup(page);
        await expect(page.getByText(changedMessage, { exact: true })).toHaveCount(0);
        await page.getByRole("button", { name: "購入先を追加", exact: true }).click();
        await page.getByRole("textbox", { name: "購入先の名前", exact: true }).fill("Local shop");
        await page.getByRole("button", { name: "確定", exact: true }).click();
        await expect(page.getByText(changedMessage, { exact: true })).toBeVisible();

        await downloadBackup(page);
        await expect(page.getByText(changedMessage, { exact: true })).toHaveCount(0);
        await page.locator("#settings-nsfw-blur").click();
        await expect(page.locator("#settings-nsfw-blur")).toHaveAttribute("aria-checked", "false");
        await expect(page.getByText(changedMessage, { exact: true })).toBeVisible();

        await downloadBackup(page);
        await expect(page.getByText(changedMessage, { exact: true })).toHaveCount(0);
        await page.goto("/vn/v1");
        await page.getByRole("textbox", { name: "感想・レビュー", exact: true }).fill("draft only");
        await expect(page.getByText("下書き保存済み・記録には未反映", { exact: true })).toBeVisible();
        await page.goto("/settings");
        await expect(page.getByText(changedMessage, { exact: true })).toHaveCount(0);
    });

    test("keeps the fingerprint for the exported snapshot when settings change during export", async ({ page }) => {
        await page.addInitScript(() => {
            const createObjectURL = URL.createObjectURL.bind(URL);
            Object.defineProperty(URL, "createObjectURL", {
                configurable: true,
                value: (blob: Blob) => {
                    const url = createObjectURL(blob);
                    if (blob.type === "application/json") {
                        localStorage.setItem("vn-manager-nsfw-blur", "false");
                    }
                    return url;
                },
            });
        });
        await page.goto("/settings");

        const { data } = await downloadBackup(page);
        expect(data.settings.nsfwBlur).toBe(true);
        await expect(page.evaluate(() => localStorage.getItem("vn-manager-nsfw-blur"))).resolves.toBe("false");
        await expect(page.evaluate(() => localStorage.getItem("vn-manager-last-export-fingerprint")))
            .resolves.toBe(await fingerprintBackupDocument(data));
        await expect(page.getByText("前回のバックアップ以降にデータが変更されています。最新状態を保存するには、もう一度エクスポートしてください。", { exact: true })).toBeVisible();
    });

    test("persists language and records the final export time", async ({ page }) => {
        await page.addInitScript(() => {
            if (sessionStorage.getItem("settings-background-seeded")) return;
            localStorage.setItem("vn-manager-bg", "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=");
            localStorage.setItem("vn-manager-bg-sexual", "1");
            sessionStorage.setItem("settings-background-seeded", "true");
        });
        await page.goto("/");
        await seedLibraryItem(page, "v3", { score: 95 });
        await page.reload();
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
        await expect(page.getByText("背景画像が設定されています。", { exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "背景画像を削除", exact: true })).toBeEnabled();

        await page.getByRole("button", { name: "英語", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("lang", "en");
        await page.goto("/ranking");
        const fixtureRankingRow = page.getByRole("link", { name: "Fixture VN Three", exact: true });
        await expect(fixtureRankingRow.locator("img")).not.toHaveClass(/blur-md/);
        await expect(fixtureRankingRow.getByText("Image blurred", { exact: true })).toHaveCount(0);
        await page.goto("/settings");
        await page.reload();
        await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
        await expect(page.locator("#settings-nsfw-blur")).toHaveAttribute("aria-checked", "false");
        await expect(page.getByText("A background image is set.", { exact: true })).toBeVisible();
        await expect(page.evaluate(() => localStorage.getItem("vn-manager-bg-sexual"))).resolves.toBe("1");
        await expect(page.getByRole("button", { name: "Japanese", exact: true })).toHaveAttribute(
            "aria-pressed",
            "false",
        );

        await page.getByRole("button", { name: "Remove background image", exact: true }).click();
        await expect(page.getByText("No background image is set.", { exact: true })).toBeVisible();
        await expect(page.evaluate(() => localStorage.getItem("vn-manager-bg"))).resolves.toBeNull();
        await expect(page.evaluate(() => localStorage.getItem("vn-manager-bg-sexual"))).resolves.toBeNull();
        await page.reload();
        await expect(page.getByText("No background image is set.", { exact: true })).toBeVisible();
        await expect(page.locator("#settings-nsfw-blur")).toHaveAttribute("aria-checked", "false");
    });

    test("keeps the previous export time when export fails", async ({ page }) => {
        const previousExportAt = "2025-01-02T03:04:05.000Z";
        const previousFingerprint = "0".repeat(64);
        await page.addInitScript((exportAt) => {
            localStorage.setItem("vn-manager-last-export-at", exportAt);
            localStorage.setItem("vn-manager-last-export-fingerprint", "0".repeat(64));
            Object.defineProperty(URL, "createObjectURL", {
                configurable: true,
                value: () => {
                    throw new Error("fixture export failure");
                },
            });
        }, previousExportAt);
        await page.goto("/settings");

        const changedMessage = "前回のバックアップ以降にデータが変更されています。最新状態を保存するには、もう一度エクスポートしてください。";
        await expect(page.getByText(changedMessage, { exact: true })).toBeVisible();
        await page.getByRole("button", { name: "バックアップをダウンロード (JSON)", exact: true }).click();
        await expect(page.getByRole("region", { name: "データとバックアップ" }).getByRole("alert")).toContainText(
            "データのエクスポートに失敗しました",
        );
        await expect(page.evaluate(() => localStorage.getItem("vn-manager-last-export-at"))).resolves.toBe(previousExportAt);
        await expect(page.evaluate(() => localStorage.getItem("vn-manager-last-export-fingerprint"))).resolves.toBe(previousFingerprint);
        await expect(page.getByText(changedMessage, { exact: true })).toBeVisible();
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
        await page.getByRole("textbox", { name: "購入先の名前", exact: true }).fill("Custom store");
        await page.getByRole("button", { name: "確定", exact: true }).click();
        await expect(page.getByRole("button", { name: "購入先を管理", exact: true })).toBeVisible();

        await page.getByRole("button", { name: "購入先を管理", exact: true }).click();
        await expect(page.getByRole("dialog")).toContainText("Custom store");
    });

    test("validates duplicate purchase locations and preserves renamed record references", async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto("/");
        await seedPurchaseSources(page, ["Steam", "DMM", "Package"]);
        await seedLibraryItem(page, "v1", {
            status: "playing",
            ownership: "owned",
            score: 0,
            playTime: 123,
            resumeNote: "Keep this resume note",
            notes: "Keep these notes",
            review: "Keep this review",
            startedOn: "2025-01-02",
            lastPlayedOn: "2025-01-03",
            purchaseLocation: "Steam",
        });
        await page.reload();
        await page.goto("/settings");

        const addButton = page.getByRole("button", { name: "購入先を追加", exact: true });
        await expect(addButton).toBeVisible();
        expect((await addButton.boundingBox())?.height).toBeGreaterThanOrEqual(44);
        await addButton.click();
        const newName = page.getByRole("textbox", { name: "購入先の名前", exact: true });
        await newName.fill("Local shop");
        await newName.press("Enter");
        await expect(page.getByRole("button", { name: "購入先を追加", exact: true })).toBeVisible();

        await page.getByRole("button", { name: "購入先を追加", exact: true }).click();
        await page.getByRole("textbox", { name: "購入先の名前", exact: true }).fill("Local shop");
        await page.getByRole("button", { name: "確定", exact: true }).click();
        await expect(page.getByText("この購入先はすでに登録されています。", { exact: true })).toBeVisible();
        await expect.poll(() => readPurchaseSourceNames(page)).toEqual(["DMM", "Local shop", "Package", "Steam"]);
        await page.getByRole("button", { name: "キャンセル", exact: true }).click();

        const recordBeforeRename = await readLibraryItem(page, "v1");
        if (!recordBeforeRename) throw new Error("Seeded library record was not found");

        await page.getByRole("button", { name: "購入先を管理", exact: true }).click();
        const dialog = page.getByRole("dialog");
        for (const name of ["編集: Steam", "削除: Package"]) {
            const button = dialog.getByRole("button", { name, exact: true });
            await expect.poll(async () => (await button.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(44);
            await expect.poll(async () => (await button.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
        }
        await dialog.getByRole("button", { name: "編集: Steam", exact: true }).click();
        await dialog.getByRole("textbox", { name: "編集: Steam", exact: true }).fill("Renamed Steam");
        await dialog.getByRole("button", { name: "確定", exact: true }).click();
        await expect(dialog).toContainText("Renamed Steam");
        await expect.poll(() => readPurchaseSourceNames(page)).toContain("Renamed Steam");
        const recordAfterRename = await readLibraryItem(page, "v1");
        if (!recordAfterRename) throw new Error("Renamed library record was not found");
        expect(recordAfterRename).toEqual({
            ...recordBeforeRename,
            updatedAt: recordAfterRename.updatedAt,
            purchaseLocation: "Renamed Steam",
        });

        await dialog.getByRole("button", { name: "編集: Renamed Steam", exact: true }).click();
        await dialog.getByRole("textbox", { name: "編集: Renamed Steam", exact: true }).fill("DMM");
        const duplicateMessage = page.getByText("この購入先はすでに登録されています。", { exact: true });
        const duplicateCountBeforeRename = await duplicateMessage.count();
        await dialog.getByRole("button", { name: "確定", exact: true }).click();
        await expect(duplicateMessage).toHaveCount(duplicateCountBeforeRename + 1);
        await expect(duplicateMessage.last()).toBeVisible();
        await expect(dialog.getByRole("textbox", { name: "編集: Renamed Steam", exact: true })).toHaveValue("DMM");
        await dialog.getByRole("button", { name: "キャンセル", exact: true }).click();

        page.once("dialog", (confirmDialog) => confirmDialog.accept());
        await dialog.getByRole("button", { name: "削除: Package", exact: true }).focus();
        await page.keyboard.press("Enter");
        await expect(dialog).not.toContainText("Package");
        await expect.poll(() => readPurchaseSourceNames(page)).not.toContain("Package");
    });

    test("updates About guidance without changing its supported languages", async ({ page }) => {
        await page.goto("/settings");
        await page.getByRole("button", { name: "英語", exact: true }).click();
        await page.goto("/about");
        await expect(page.getByRole("listitem").filter({ hasText: "Find and add titles from Find titles in the sidebar or menu." })).toBeVisible();
        await expect(page.getByText("Dark Mode", { exact: true })).toHaveCount(0);
        await expect(page.getByText(/IndexedDB \/ localStorage/)).toBeVisible();
        await page.getByRole("button", { name: "Local Version (For Developers)", exact: true }).click();
        await expect(page.getByRole("link", { name: "View on GitHub", exact: true })).toHaveAttribute(
            "href",
            "https://github.com/neco75/vn-manager",
        );

        await page.goto("/settings");
        await page.getByRole("button", { name: "Japanese", exact: true }).click();
        await page.goto("/about");
        await expect(page.getByRole("listitem").filter({ hasText: "サイドバーまたはメニューの「作品を探す」から、好きなゲームを探して追加。" })).toBeVisible();
        await expect(page.getByText("ダークモード対応", { exact: true })).toHaveCount(0);
        await expect(page.getByText(/IndexedDB \/ localStorage/)).toBeVisible();
        await page.getByRole("button", { name: "ローカル版 (開発者向け)", exact: true }).click();
        await expect(page.getByRole("link", { name: "GitHubで見る", exact: true })).toHaveAttribute(
            "href",
            "https://github.com/neco75/vn-manager",
        );
    });

    test("captures settings and About at desktop and mobile widths", async ({ page }) => {
        const cases = [
            { width: 1440, height: 1000, language: "ja", file: "v2-12-settings-1440x1000-ja.png" },
            { width: 390, height: 844, language: "en", file: "v2-12-settings-390x844-en.png" },
            { width: 390, height: 667, language: "ja", file: "v2-12-settings-390x667-ja.png" },
        ] as const;

        for (const capture of cases) {
            await page.setViewportSize({ width: capture.width, height: capture.height });
            await page.goto("/settings");
            await page.evaluate((language) => localStorage.setItem("vn-manager-lang", language), capture.language);
            await page.reload();
            await expect(page.locator("html")).toHaveAttribute("lang", capture.language);
            await page.evaluate(() => window.scrollTo(0, 0));
            await expect(page.locator("main > div")).toHaveCSS("max-width", "760px");
            await expect(page.getByRole("heading", {
                name: capture.language === "ja" ? "設定" : "Settings",
                exact: true,
            })).toBeVisible();
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.screenshot({ path: `e2e/screenshots/${capture.file}`, animations: "disabled" });
        }

        for (const capture of [
            { language: "ja", heading: "VN Managerについて", file: "v2-12-about-1440x1000-ja.png" },
            { language: "en", heading: "About VN Manager", file: "v2-12-about-1440x1000-en.png" },
        ] as const) {
            await page.setViewportSize({ width: 1440, height: 1000 });
            await page.goto("/settings");
            await page.evaluate((language) => localStorage.setItem("vn-manager-lang", language), capture.language);
            await page.reload();
            await expect(page.locator("html")).toHaveAttribute("lang", capture.language);
            await page.goto("/about");
            await expect(page.getByRole("heading", { name: capture.heading, exact: true })).toBeVisible();
            await expect(page.locator("main > div")).toHaveCSS("max-width", "760px");
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.screenshot({ path: `e2e/screenshots/${capture.file}`, animations: "disabled" });
        }
    });
});
