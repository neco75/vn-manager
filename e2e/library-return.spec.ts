import { expect, test, type Page } from "@playwright/test";
import { LIBRARY_RETURN_STORAGE_KEY } from "@/lib/detail-return";
import { LIBRARY_RECORD_VERSION, type LibraryItem } from "@/types/library";
import type { VN } from "@/types/vndb";
import fixture from "./fixtures/vndb.json";
import { mockVNDB, readLibraryItem, seedLibraryItem, seedLibraryItems } from "./helpers";

const RETURN_PATH = "/?status=playing&sort=title_asc&view=list";
const FIXTURE_VN = fixture.vns.v1 as unknown as VN;

function makeReturnItems(count: number): LibraryItem[] {
    return Array.from({ length: count }, (_, index) => {
        const number = String(index + 1).padStart(3, "0");
        const id = index === 84 ? "v1" : `return-${number}`;
        return {
            recordVersion: LIBRARY_RECORD_VERSION,
            vn: { ...structuredClone(FIXTURE_VN), id, title: `Library Return ${number}` },
            status: "playing",
            ownership: "unknown",
            score: null,
            notes: "",
            addedAt: index + 1,
            updatedAt: index + 1,
        };
    });
}

async function expectScrollRestored(page: Page, expected: number) {
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    const actual = await page.evaluate(() => window.scrollY);
    expect(Math.abs(actual - expected)).toBeLessThanOrEqual(24);
}

test.describe("library detail return", () => {
    test("restores the filtered 100-item list through browser and app navigation on desktop and mobile", async ({ page }) => {
        await mockVNDB(page);
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.goto("/");
        await seedLibraryItems(page, makeReturnItems(100));
        await page.goto(RETURN_PATH);

        const target = page.locator('a[href^="/vn/v1?from="]');
        await expect(target).toHaveCount(1);
        await target.scrollIntoViewIfNeeded();
        const desktopScroll = await page.evaluate(() => window.scrollY);
        expect(desktopScroll).toBeGreaterThan(0);

        await target.click();
        await expect(page).toHaveURL(/\/vn\/v1\?from=/);
        await expect(page.getByRole("heading", { name: "Fixture VN One" })).toBeVisible();
        await expect(page.getByRole("link", { name: "戻る", exact: true })).toHaveAttribute("href", RETURN_PATH);
        await expect(page.getByRole("textbox", { name: "感想・レビュー" })).toBeEnabled();
        await expect(page.getByRole("heading", { name: "自分の記録" }).locator("xpath=../.."))
            .toHaveCSS("opacity", "1");
        await expect.poll(() => page.evaluate((key) => {
            const raw = window.sessionStorage.getItem(key);
            return raw ? JSON.parse(raw) as unknown : null;
        }, LIBRARY_RETURN_STORAGE_KEY)).toEqual({ path: RETURN_PATH, scrollY: desktopScroll });
        await page.screenshot({ path: "e2e/screenshots/v2-05-detail-1440x1000.png" });

        await page.goBack();
        await expect(page).toHaveURL(RETURN_PATH);
        await expectScrollRestored(page, desktopScroll);
        expect(await page.evaluate((key) => window.sessionStorage.getItem(key), LIBRARY_RETURN_STORAGE_KEY)).toBeNull();

        await page.goForward();
        await expect(page).toHaveURL(/\/vn\/v1\?from=/);
        await expect(page.getByRole("link", { name: "戻る", exact: true })).toHaveAttribute("href", RETURN_PATH);
        await page.goBack();
        await expect(page).toHaveURL(RETURN_PATH);
        await expectScrollRestored(page, desktopScroll);

        const desktopTarget = page.locator('a[href^="/vn/v1?from="]');
        await desktopTarget.scrollIntoViewIfNeeded();
        const appReturnScroll = await page.evaluate(() => window.scrollY);
        await desktopTarget.click();
        await expect(page).toHaveURL(/\/vn\/v1\?from=/);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.getByRole("link", { name: "戻る", exact: true }).click();
        await expect(page).toHaveURL(RETURN_PATH);
        await expectScrollRestored(page, appReturnScroll);
        await page.screenshot({ path: "e2e/screenshots/v2-05-library-return-1440x1000.png" });

        await page.setViewportSize({ width: 390, height: 844 });
        const mobileTarget = page.locator('a[href^="/vn/v1?from="]');
        await mobileTarget.scrollIntoViewIfNeeded();
        const mobileScroll = await page.evaluate(() => window.scrollY);
        await mobileTarget.click();
        await expect(page).toHaveURL(/\/vn\/v1\?from=/);
        await expect(page.getByRole("heading", { name: "Fixture VN One" })).toBeVisible();
        await expect(page.getByRole("textbox", { name: "感想・レビュー" })).toBeEnabled();
        await expect(page.getByRole("heading", { name: "自分の記録" }).locator("xpath=../.."))
            .toHaveCSS("opacity", "1");
        await page.setViewportSize({ width: 390, height: 667 });
        await page.screenshot({ path: "e2e/screenshots/v2-05-detail-390x667.png", fullPage: false });

        await page.evaluate(() => window.scrollTo(0, 0));
        await page.getByRole("link", { name: "戻る", exact: true }).click();
        await expect(page).toHaveURL(RETURN_PATH);
        await expectScrollRestored(page, mobileScroll);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ path: "e2e/screenshots/v2-05-library-return-390x844.png" });

        for (const view of ["grid", "shelf"] as const) {
            const viewPath = view === "grid"
                ? "/?status=playing&sort=title_asc"
                : `/?status=playing&sort=title_asc&view=${view}`;
            await page.goto(viewPath);
            const viewTarget = page.locator('a[href^="/vn/v1?from="]').first();
            await viewTarget.scrollIntoViewIfNeeded();
            const viewScroll = await page.evaluate(() => window.scrollY);
            expect(viewScroll).toBeGreaterThan(0);
            await viewTarget.click();
            await expect(page).toHaveURL(/\/vn\/v1\?from=/);
            await expect(page.getByRole("link", { name: "戻る", exact: true })).toHaveAttribute("href", viewPath);
            await expect.poll(() => page.evaluate((key) => {
                const raw = window.sessionStorage.getItem(key);
                return raw ? JSON.parse(raw) as unknown : null;
            }, LIBRARY_RETURN_STORAGE_KEY)).toEqual({ path: viewPath, scrollY: viewScroll });
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.getByRole("link", { name: "戻る", exact: true }).click();
            await expect(page).toHaveURL(viewPath);
            await expectScrollRestored(page, viewScroll);
        }
    });

    test("ignores stale and malformed library return snapshots", async ({ page }) => {
        await mockVNDB(page);
        await page.goto("/");
        await seedLibraryItems(page, makeReturnItems(100));
        await page.goto(RETURN_PATH);
        await expect(page.locator('a[href^="/vn/"]')).toHaveCount(100);

        await page.evaluate(({ key, path }) => {
            window.sessionStorage.setItem(key, JSON.stringify({ path: path.replace("status=playing", "status=completed"), scrollY: 7000 }));
        }, { key: LIBRARY_RETURN_STORAGE_KEY, path: RETURN_PATH });
        await page.reload();
        await expect(page).toHaveURL(RETURN_PATH);
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

        await page.evaluate(({ key, path }) => {
            window.sessionStorage.setItem(key, JSON.stringify({ path, scrollY: 7000, extra: true }));
        }, { key: LIBRARY_RETURN_STORAGE_KEY, path: RETURN_PATH });
        await page.reload();
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
        await expect(page.locator('a[href^="/vn/"]')).toHaveCount(100);

        const directTab = await page.context().newPage();
        await mockVNDB(directTab);
        await directTab.goto("/vn/v1");
        await expect(directTab.getByRole("link", { name: "戻る", exact: true })).toHaveAttribute("href", "/");
        await directTab.close();
    });

    test("keeps detail navigation and saving available when library session storage throws", async ({ page }) => {
        await page.addInitScript((key) => {
            const getItem = Storage.prototype.getItem;
            const setItem = Storage.prototype.setItem;
            const removeItem = Storage.prototype.removeItem;
            Storage.prototype.getItem = function (name) {
                if (name === key) throw new Error("session storage read blocked");
                return getItem.call(this, name);
            };
            Storage.prototype.setItem = function (name, value) {
                if (name === key) throw new Error("session storage write blocked");
                return setItem.call(this, name, value);
            };
            Storage.prototype.removeItem = function (name) {
                if (name === key) throw new Error("session storage cleanup blocked");
                return removeItem.call(this, name);
            };
        }, LIBRARY_RETURN_STORAGE_KEY);
        await mockVNDB(page);
        await page.goto("/");
        await seedLibraryItem(page, "v1");
        await page.reload();

        await page.locator('a[href^="/vn/v1?from="]').click();
        await expect(page).toHaveURL(/\/vn\/v1\?from=/);
        await expect(page.getByRole("heading", { name: "Fixture VN One" })).toBeVisible();
        await page.getByRole("textbox", { name: "感想・レビュー" }).fill("saved while session storage is unavailable");
        await page.getByRole("button", { name: "変更を保存", exact: true }).click();
        await expect(page.getByText("本記録は保存済み", { exact: true })).toBeVisible();
        await expect.poll(async () => (await readLibraryItem(page, "v1"))?.review)
            .toBe("saved while session storage is unavailable");

        await page.getByRole("link", { name: "戻る", exact: true }).click();
        await expect(page).toHaveURL("/");
        await expect(page.locator('a[href^="/vn/v1?from="]')).toBeVisible();
    });
});
