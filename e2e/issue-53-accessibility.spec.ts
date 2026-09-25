import { expect, test } from "@playwright/test";
import { mockVNDB, seedLibraryItem } from "./helpers";

const BRIGHT_BACKGROUND =
    "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%228%22%20height%3D%228%22%3E%3Crect%20width%3D%228%22%20height%3D%228%22%20fill%3D%22white%22%2F%3E%3C%2Fsvg%3E";

type RGB = [number, number, number];

function channels(color: string): RGB {
    const values = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
    if (!values || values.length !== 3) throw new Error(`Expected an RGB color, received ${color}`);
    return values as RGB;
}

function luminance(color: RGB) {
    const [red, green, blue] = color.map((value) => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function contrastRatio(foreground: string, background: string) {
    const foregroundLuminance = luminance(channels(foreground));
    const backgroundLuminance = luminance(channels(background));
    return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
        (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}

async function expectSettingsContrast(page: import("@playwright/test").Page, language: "ja" | "en") {
    await expect(page.getByRole("heading", { name: language === "ja" ? "設定" : "Settings", exact: true })).toBeVisible();
    await page.mouse.move(0, 0);
    await page.waitForFunction(() => {
        const selectedButton = document.querySelector<HTMLElement>('main section[aria-labelledby="settings-display-title"] button[aria-pressed="true"]');
        if (!selectedButton) return false;
        const style = getComputedStyle(selectedButton);
        return style.color === "rgb(25, 27, 30)" && style.backgroundColor.startsWith("rgb(");
    });
    const colors = await page.evaluate(() => {
        const main = document.querySelector("main > div");
        const pageHeading = main?.querySelector(":scope > header > h1");
        const pageDescription = main?.querySelector(":scope > header > p");
        const displaySection = main?.querySelector('section[aria-labelledby="settings-display-title"]');
        const card = displaySection?.querySelector<HTMLElement>('[data-slot="card"]');
        const cardDescription = card?.querySelector<HTMLElement>('[data-slot="card-header"] > p');
        const selectedButton = displaySection?.querySelector<HTMLElement>('button[aria-pressed="true"]');
        const backgroundLayer = Array.from(document.querySelectorAll<HTMLElement>("div")).find((element) => {
            const style = getComputedStyle(element);
            return style.position === "fixed" && style.backgroundImage !== "none";
        });
        const color = (element: Element | null | undefined) => element ? getComputedStyle(element).color : "";
        return {
            pageBackground: getComputedStyle(document.body).backgroundColor,
            backgroundOpacity: backgroundLayer ? Number(getComputedStyle(backgroundLayer).opacity) : 0,
            heading: color(pageHeading),
            pageDescription: color(pageDescription),
            cardDescription: color(cardDescription),
            cardBackground: card ? getComputedStyle(card).backgroundColor : "",
            buttonForeground: color(selectedButton),
            buttonBackground: selectedButton ? getComputedStyle(selectedButton).backgroundColor : "",
        };
    });

    const pageBackground = channels(colors.pageBackground);
    const compositedBackground = pageBackground.map((channel) =>
        Math.round(channel * (1 - colors.backgroundOpacity) + 255 * colors.backgroundOpacity),
    ).join(", ");
    const pageSurface = `rgb(${compositedBackground})`;

    expect(contrastRatio(colors.heading, pageSurface), `${language} settings heading on page background`).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.pageDescription, pageSurface), `${language} settings description with background ${colors.backgroundOpacity}`).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.cardDescription, colors.cardBackground), `${language} settings card description`).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.buttonForeground, colors.buttonBackground), `${language} selected language button text`).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.buttonBackground, colors.cardBackground), `${language} selected language button UI`).toBeGreaterThanOrEqual(3);
}

test.describe("Issue #53 accessibility regressions", () => {
    test("keeps Japanese and English settings text and controls legible with backgrounds on and off", async ({ page }) => {
        await page.addInitScript((background) => localStorage.setItem("vn-manager-bg", background), BRIGHT_BACKGROUND);
        await page.goto("/settings");

        await expectSettingsContrast(page, "ja");
        await page.getByRole("button", { name: "英語", exact: true }).click();
        await expectSettingsContrast(page, "en");

        await page.getByRole("button", { name: "Remove background image", exact: true }).click();
        await expect(page.locator("[style*='background-image']")).toHaveCount(0);
        // Disabled controls are exempt from the contrast threshold and are deliberately not measured.
        await expect(page.getByRole("button", { name: "Remove background image", exact: true })).toBeDisabled();
        await expectSettingsContrast(page, "en");
        await page.getByRole("button", { name: "Japanese", exact: true }).click();
        await expectSettingsContrast(page, "ja");
    });

    test("matches the desktop language switch's visible EN/JA label and accessible name", async ({ page }) => {
        await page.goto("/settings");

        const languageSwitch = page.getByRole("button", { name: "EN", exact: true });
        await expect(languageSwitch).toHaveText("EN");
        await expect(languageSwitch).toHaveAccessibleName("EN");
        await languageSwitch.click();

        const japaneseSwitch = page.getByRole("button", { name: "JA", exact: true });
        await expect(japaneseSwitch).toHaveText("JA");
        await expect(japaneseSwitch).toHaveAccessibleName("JA");
    });

    test("gives the stats tag fill contrast against its track and keeps share heading readable", async ({ page }) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await mockVNDB(page);
        await page.goto("/stats");
        await seedLibraryItem(page, "v1");
        await page.reload();

        const tag = page.getByText("Adventure", { exact: true });
        await expect(tag).toBeVisible();
        const tagProgress = tag.locator("xpath=../..");
        const fill = tagProgress.getByTestId("stats-progress-fill");
        const track = tagProgress.getByTestId("stats-progress-track");
        const [fillColor, trackColor] = await Promise.all([
            fill.evaluate((element) => getComputedStyle(element).backgroundColor),
            track.evaluate((element) => getComputedStyle(element).backgroundColor),
        ]);
        expect(fillColor).not.toBe(trackColor);
        expect(contrastRatio(fillColor, trackColor), "tag progress fill versus track").toBeGreaterThanOrEqual(3);

        const heading = page.getByTestId("stats-share-heading");
        const headingColors = await heading.evaluate((element) => ({
            foreground: getComputedStyle(element).color,
            background: getComputedStyle(document.querySelector('[data-testid="stats-share-root"]')!).backgroundColor,
        }));
        expect(contrastRatio(headingColors.foreground, headingColors.background), "stats share heading").toBeGreaterThanOrEqual(4.5);

        const trackBox = await track.boundingBox();
        const fillBox = await fill.boundingBox();
        expect(trackBox).not.toBeNull();
        expect(fillBox).not.toBeNull();
        expect(fillBox!.width / trackBox!.width, "reduced motion completes the progress width immediately").toBeGreaterThan(0.95);
    });

    test("names the actual Radix slider thumb", async ({ page }) => {
        await mockVNDB(page);
        await page.goto("/vn/v1");

        await expect(page.getByRole("slider", { name: "スコア", exact: true })).toBeVisible();
    });

    test("shows keyboard focus on the Markdown textarea without removing its scroll margin", async ({ page }) => {
        await mockVNDB(page);
        await page.goto("/vn/v1");

        const textarea = page.locator("#detail-notes");
        await expect(textarea).toBeVisible();
        await expect(textarea).toHaveClass(/scroll-mt-56/);
        await expect(textarea).toHaveClass(/sm:scroll-mt-36/);
        const lastToolbarButton = textarea.locator("xpath=preceding-sibling::div[1]").getByRole("button").last();
        await lastToolbarButton.focus();
        await page.keyboard.press("Tab");
        await expect(textarea).toBeFocused();

        const focusStyle = await textarea.evaluate((element) => {
            const style = getComputedStyle(element);
            return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, outlineColor: style.outlineColor };
        });
        expect(focusStyle.outlineStyle).toBe("solid");
        expect(focusStyle.outlineWidth).toBe("2px");
        expect(contrastRatio(focusStyle.outlineColor, "rgb(37, 41, 45)"), "Markdown keyboard focus outline").toBeGreaterThanOrEqual(3);
    });

    test("respects reduced motion for decorative roulette and CSS animation", async ({ page }) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await mockVNDB(page);
        await page.goto("/");
        await seedLibraryItem(page, "v1");
        await page.reload();

        await page.getByRole("button", { name: "ルーレット", exact: true }).click();
        await page.getByRole("button", { name: "ルーレットを回す！", exact: true }).click();
        await expect(page.getByTestId("roulette-winner")).toBeVisible();

        const motionTiming = await page.evaluate(() => {
            const probe = document.createElement("div");
            probe.className = "animate-pulse transition-all";
            document.body.append(probe);
            const style = getComputedStyle(probe);
            const timing = { animation: parseFloat(style.animationDuration), transition: parseFloat(style.transitionDuration) };
            probe.remove();
            return timing;
        });
        expect(motionTiming.animation).toBeLessThan(0.001);
        expect(motionTiming.transition).toBeLessThan(0.001);
    });
});
