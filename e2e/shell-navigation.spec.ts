import { expect, test, type Page } from "@playwright/test";
import { mockVNDB } from "./helpers";

const NAV_HREFS = ["/", "/search", "/ranking", "/stats", "/settings"];

async function expectNoHorizontalOverflow(page: Page) {
    const overflows = await page.evaluate(() =>
        Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > document.documentElement.clientWidth + 1,
    );
    expect(overflows).toBe(false);
}

async function expectVisibleFocusRing(locator: import("@playwright/test").Locator) {
    await expect(locator).toHaveClass(/focus-visible:ring-2/);
    const boxShadow = await locator.evaluate((element) => getComputedStyle(element).boxShadow);
    expect(boxShadow).not.toBe("none");
}

test.describe("共通画面枠", () => {
    async function seedShellPreferences(page: Page) {
        await page.addInitScript(() => {
            const background = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiPjxwYXRoIGZpbGw9IiMwMDAiIGQ9Ik0wIDBoMXYxSDB6Ii8+PC9zdmc+";
            if (localStorage.getItem("vn-manager-bg") === null) localStorage.setItem("vn-manager-bg", background);
            if (localStorage.getItem("vn-manager-bg-sexual") === null) localStorage.setItem("vn-manager-bg-sexual", "2");
            if (localStorage.getItem("vn-manager-nsfw-blur") === null) localStorage.setItem("vn-manager-nsfw-blur", "true");
            if (localStorage.getItem("vn-manager-lang") === null) localStorage.setItem("vn-manager-lang", "ja");
        });
    }

    for (const width of [1024, 1440]) {
        test(`PC ${width}px でサイドバーと操作を保つ`, async ({ page }) => {
            await page.setViewportSize({ width, height: 600 });
            await seedShellPreferences(page);
            await page.goto("/");

            const sidebar = page.locator("aside");
            const main = page.locator("main");
            await expect(sidebar).toBeVisible();
            await expect(sidebar).toHaveCSS("width", "240px");
            await expect(sidebar).toHaveCSS("height", "600px");
            await expect(page.locator("header.sticky")).toBeHidden();
            await expect(main).toHaveCount(1);
            const navigation = sidebar.getByRole("navigation");
            const links = navigation.getByRole("link");
            await expect(links).toHaveCount(NAV_HREFS.length);
            for (let index = 0; index < NAV_HREFS.length; index += 1) {
                await expect(links.nth(index)).toBeVisible();
                await expect(links.nth(index)).toHaveAttribute("href", NAV_HREFS[index]);
            }
            await expect(sidebar.getByRole("link", { name: "ライブラリ" })).toHaveAttribute("aria-current", "page");
            await expect(sidebar.getByRole("switch", { name: "画像をぼかす" })).toHaveAttribute("aria-checked", "true");
            await expect(sidebar.getByRole("button", { name: "EN" })).toBeVisible();
            await expect(sidebar.getByRole("button", { name: "EN" })).toHaveText("EN");

            const geometry = await page.evaluate(() => {
                const asideRect = document.querySelector("aside")!.getBoundingClientRect();
                const mainRect = document.querySelector("main")!.getBoundingClientRect();
                return { asideRight: asideRect.right, mainLeft: mainRect.left, mainWidth: mainRect.width };
            });
            expect(geometry.mainLeft).toBeGreaterThanOrEqual(geometry.asideRight);
            expect(geometry.mainWidth).toBeLessThanOrEqual(1280);
            await expectNoHorizontalOverflow(page);

            const brand = sidebar.getByRole("link", { name: "VN Manager", exact: true });
            const libraryLink = sidebar.getByRole("navigation").getByRole("link", { name: "ライブラリ" });
            await page.keyboard.press("Tab");
            await expect(brand).toBeFocused();
            await expectVisibleFocusRing(brand);
            await page.keyboard.press("Tab");
            await expect(libraryLink).toBeFocused();
            await expectVisibleFocusRing(libraryLink);

            const backgroundLayer = page.locator('div[style*="background-image"]');
            await expect(backgroundLayer).toHaveCount(1);
            await expect(backgroundLayer).toHaveClass(/blur-3xl/);
            await sidebar.getByRole("switch", { name: "画像をぼかす" }).click();
            await expect(sidebar.getByRole("switch", { name: "画像をぼかす" })).toHaveAttribute("aria-checked", "false");
            await expect(backgroundLayer).toHaveClass(/blur-sm/);
            await expect.poll(() => page.evaluate(() => localStorage.getItem("vn-manager-nsfw-blur"))).toBe("false");

            await sidebar.getByRole("button", { name: "EN" }).click();
            await expect(page.locator("html")).toHaveAttribute("lang", "en");
            await expect(sidebar.getByRole("navigation").getByRole("link", { name: "Library" })).toHaveAttribute("aria-current", "page");
            await page.reload();
            await expect(page.locator("html")).toHaveAttribute("lang", "en");
            await expect(sidebar.getByRole("switch", { name: "Blur images" })).toHaveAttribute("aria-checked", "false");
            await expect(page.locator('div[style*="background-image"]')).toHaveClass(/blur-sm/);
        });
    }

    for (const width of [320, 390, 768]) {
        test(`小画面 ${width}px でDialogメニューをキーボード操作できる`, async ({ page }) => {
            await page.setViewportSize({ width, height: 600 });
            await seedShellPreferences(page);
            await page.goto("/");

            const header = page.locator("header.sticky");
            const menuButton = page.locator('header.sticky button[aria-haspopup="dialog"]');
            await expect(menuButton).toHaveAccessibleName("メニュー");
            const brand = header.getByRole("link", { name: "VN Manager", exact: true });
            await expect(header).toBeVisible();
            await expect(header).toHaveCSS("height", "56px");
            await expect(brand).toHaveCSS("min-height", "44px");
            await expect(page.locator("aside")).toBeHidden();
            await expect(page.locator("main")).toHaveCount(1);
            await expectNoHorizontalOverflow(page);

            await page.keyboard.press("Tab");
            await expect(brand).toBeFocused();
            await expectVisibleFocusRing(brand);
            await page.keyboard.press("Tab");
            await expect(menuButton).toBeFocused();
            await expect(menuButton).toHaveClass(/focus-visible:ring-ring/);
            await page.keyboard.press("Enter");
            const dialog = page.getByRole("dialog");
            await expect(dialog).toBeVisible();
            const navigation = dialog.getByRole("navigation", { name: "メインナビゲーション" });
            const links = navigation.getByRole("link");
            await expect(links).toHaveCount(NAV_HREFS.length);
            for (let index = 0; index < NAV_HREFS.length; index += 1) {
                await expect(links.nth(index)).toBeVisible();
                await expect(links.nth(index)).toHaveAttribute("href", NAV_HREFS[index]);
            }
            await expect(navigation.getByRole("link", { name: "ライブラリ" })).toHaveAttribute("aria-current", "page");
            await expect(dialog.getByRole("switch", { name: "画像をぼかす" })).toHaveAttribute("aria-checked", "true");
            await expect(dialog.getByRole("button", { name: /言語/ })).toBeVisible();
            await expect(page.locator('div[style*="background-image"]')).toHaveClass(/blur-3xl/);

            await dialog.getByRole("switch", { name: "画像をぼかす" }).click();
            await expect(dialog.getByRole("switch", { name: "画像をぼかす" })).toHaveAttribute("aria-checked", "false");
            await expect(page.locator('div[style*="background-image"]')).toHaveClass(/blur-sm/);
            await expect.poll(() => page.evaluate(() => localStorage.getItem("vn-manager-nsfw-blur"))).toBe("false");

            await dialog.getByRole("button", { name: /言語/ }).click();
            await expect(page.locator("html")).toHaveAttribute("lang", "en");
            await page.keyboard.press("Escape");
            await expect(dialog).toBeHidden();
            await expect(menuButton).toBeFocused();

            await page.reload();
            await expect(page.locator("html")).toHaveAttribute("lang", "en");
            await expect(page.locator('div[style*="background-image"]')).toHaveClass(/blur-sm/);
            await menuButton.click();
            await expect(dialog.getByRole("switch", { name: "Blur images" })).toHaveAttribute("aria-checked", "false");
            const englishNavigation = dialog.getByRole("navigation", { name: "Main navigation" });
            await englishNavigation.getByRole("link", { name: "Find titles" }).click();
            await expect(page).toHaveURL(/\/search$/);
            await expect(dialog).toBeHidden();
            await expect(menuButton).toBeFocused();
            await expectNoHorizontalOverflow(page);

            await page.goto("/settings");
            await page.getByRole("link", { name: "Open the full explanation", exact: true }).click();
            await expect(page).toHaveURL(/\/about$/);
            await expect(page.getByRole("heading", { name: "About VN Manager", exact: true })).toBeVisible();
        });
    }

    test("作品詳細でもライブラリを選択状態にし、ナビを5件に保つ", async ({ page }) => {
        await page.setViewportSize({ width: 1024, height: 600 });
        await mockVNDB(page);
        await page.goto("/vn/v1");
        const nav = page.locator("aside").getByRole("navigation");
        await expect(nav.getByRole("link")).toHaveCount(5);
        await expect(nav.getByRole("link", { name: "ライブラリ" })).toHaveAttribute("aria-current", "page");
    });
});
