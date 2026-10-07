import { expect, test, type Locator } from "@playwright/test";
import { mockVNDB, openAdditionalRecordFields, seedLibraryItem } from "./helpers";
import fixture from "./fixtures/vndb.json";
import type { VN } from "@/types/vndb";

const BRIGHT_BACKGROUND =
    "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%228%22%20height%3D%228%22%3E%3Crect%20width%3D%228%22%20height%3D%228%22%20fill%3D%22white%22%2F%3E%3C%2Fsvg%3E";
const DARK_BACKGROUND =
    "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%228%22%20height%3D%228%22%3E%3Crect%20width%3D%228%22%20height%3D%228%22%20fill%3D%22black%22%2F%3E%3C%2Fsvg%3E";

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

async function renderedColors(locator: Locator) {
    return locator.evaluate((element) => {
        let ancestor: HTMLElement | null = element as HTMLElement;
        let background = getComputedStyle(document.body).backgroundColor;

        while (ancestor) {
            const candidate = getComputedStyle(ancestor).backgroundColor;
            const values = candidate.match(/[\d.]+/g);
            const alpha = values && values.length > 3 ? Number(values[3]) : 1;
            if (values?.length && alpha >= 0.999) {
                background = candidate;
                break;
            }
            ancestor = ancestor.parentElement;
        }

        return { foreground: getComputedStyle(element).color, background };
    });
}

async function expectReadableText(locator: Locator, label: string) {
    await expect(locator).toBeVisible();
    const colors = await renderedColors(locator);
    expect(contrastRatio(colors.foreground, colors.background), label).toBeGreaterThanOrEqual(4.5);
}

async function expectMainMutedTextContrast(page: import("@playwright/test").Page, label: string) {
    const main = page.locator("main");
    await expect(main).toHaveCSS("background-color", "rgb(252, 252, 255)");
    await expect(main).toHaveCSS("background-clip", "content-box");

    const paragraphs = main.locator("p.text-muted-foreground");
    await expect(paragraphs.first()).toBeVisible();
    for (const paragraph of await paragraphs.all()) {
        const colors = await paragraph.evaluate((element) => ({
            foreground: getComputedStyle(element).color,
            background: getComputedStyle(element.closest("main")!).backgroundColor,
            text: element.textContent?.trim() ?? "",
        }));
        expect(contrastRatio(colors.foreground, colors.background), `${label}: ${colors.text}`).toBeGreaterThanOrEqual(4.5);
    }
}

async function expectDiscernibleUI(locator: Locator, label: string) {
    await expect(locator).toBeVisible();
    const colors = await renderedColors(locator);
    expect(contrastRatio(colors.foreground, colors.background), label).toBeGreaterThanOrEqual(3);
}

async function expectSettingsContrast(
    page: import("@playwright/test").Page,
    language: "ja" | "en",
    backgroundPixel: RGB = [255, 255, 255],
) {
    await expect(page.getByRole("heading", { name: language === "ja" ? "設定" : "Settings", exact: true })).toBeVisible();
    await page.mouse.move(0, 0);
    const selectedLanguageButton = page.locator('main section[aria-labelledby="settings-display-title"] button[aria-pressed="true"]');
    await expect.poll(() => selectedLanguageButton.evaluate((element) => {
        const style = getComputedStyle(element);
        return [style.color, style.backgroundColor];
    })).toEqual(["rgb(255, 255, 255)", "rgb(91, 80, 230)"]);
    const colors = await page.evaluate(() => {
        const main = document.querySelector("main > div");
        const pageHeading = main?.querySelector(":scope > header > h1");
        const pageDescription = main?.querySelector(":scope > header > p");
        const displaySection = main?.querySelector('section[aria-labelledby="settings-display-title"]');
        const displayOptions = displaySection?.querySelector<HTMLElement>('[data-testid="settings-display-options"]');
        const displayDescription = displayOptions?.querySelector<HTMLElement>(":scope > p");
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
            pageDescriptionBackground: pageDescription ? getComputedStyle(pageDescription).backgroundColor : "",
            displayDescription: color(displayDescription),
            displaySurface: displayOptions ? getComputedStyle(displayOptions).backgroundColor : "",
            buttonForeground: color(selectedButton),
            buttonBackground: selectedButton ? getComputedStyle(selectedButton).backgroundColor : "",
        };
    });

    const pageBackground = channels(colors.pageBackground);
    const compositedBackground = pageBackground.map((channel, index) =>
        Math.round(channel * (1 - colors.backgroundOpacity) + backgroundPixel[index] * colors.backgroundOpacity),
    );
    const pageSurface = `rgb(${compositedBackground.join(", ")})`;
    const descriptionBackgroundValues = colors.pageDescriptionBackground.match(/[\d.]+/g);
    const descriptionBackground = channels(colors.pageDescriptionBackground);
    const descriptionBackgroundOpacity = descriptionBackgroundValues?.[3] === undefined
        ? 1
        : Number(descriptionBackgroundValues[3]);
    const descriptionSurface = `rgb(${descriptionBackground.map((channel, index) =>
        Math.round(channel * descriptionBackgroundOpacity + compositedBackground[index] * (1 - descriptionBackgroundOpacity)),
    ).join(", ")})`;

    expect(contrastRatio(colors.heading, pageSurface), `${language} settings heading on page background`).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.pageDescription, descriptionSurface), `${language} settings description with background ${colors.backgroundOpacity}`).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.displayDescription, colors.displaySurface), `${language} settings display description`).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.buttonForeground, colors.buttonBackground), `${language} selected language button text`).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.buttonBackground, colors.displaySurface), `${language} selected language button UI`).toBeGreaterThanOrEqual(3);
}

async function expectSearchInputContrast(page: import("@playwright/test").Page, language: "ja" | "en") {
    const label = language === "ja" ? "タイトルで検索" : "Search by title";
    const input = page.getByRole("textbox", { name: label, exact: true });
    await expect(input).toBeVisible();

    const colors = await input.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
            foreground: style.color,
            background: style.backgroundColor,
            placeholder: getComputedStyle(element, "::placeholder").color,
            border: style.borderTopColor,
            fontSize: style.fontSize,
            height: element.getBoundingClientRect().height,
        };
    });
    expect(contrastRatio(colors.foreground, colors.background), `${language} search input text`).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.placeholder, colors.background), `${language} search input placeholder`).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.border, colors.background), `${language} search input boundary`).toBeGreaterThanOrEqual(3);
    expect(colors.fontSize).toBe("16px");
    expect(colors.height).toBeGreaterThanOrEqual(44);

    await input.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(input).toBeFocused();
    const focus = await input.evaluate((element) => {
        const style = getComputedStyle(element);
        return { border: style.borderTopColor, background: style.backgroundColor, boxShadow: style.boxShadow };
    });
    expect(focus.boxShadow).not.toBe("none");
    expect(contrastRatio(focus.border, focus.background), `${language} search input focus`).toBeGreaterThanOrEqual(3);
}

test.describe("Issue #53 accessibility regressions", () => {
    for (const scenario of [
        { name: "dark", background: DARK_BACKGROUND },
        { name: "white", background: BRIGHT_BACKGROUND },
        { name: "no image", background: null },
    ] as const) {
        for (const language of ["ja", "en"] as const) {
            test(`keeps shared page descriptions readable with ${scenario.name} background in ${language}`, async ({ page }) => {
                await page.addInitScript(({ background, savedLanguage }) => {
                    if (background) localStorage.setItem("vn-manager-bg", background);
                    else localStorage.removeItem("vn-manager-bg");
                    localStorage.removeItem("vn-manager-bg-sexual");
                    localStorage.setItem("vn-manager-lang", savedLanguage);
                }, { background: scenario.background, savedLanguage: language });

                for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
                    await page.setViewportSize(viewport);
                    for (const path of ["/search", "/ranking", "/"]) {
                        await page.goto(path);
                        await expect.poll(() => page.locator("html").getAttribute("lang")).toBe(language);

                        const backgroundLayer = page.locator('div[style*="background-image"]');
                        await expect(backgroundLayer).toHaveCount(scenario.background ? 1 : 0);
                        if (scenario.background) await expect(backgroundLayer).toHaveCSS("opacity", "0.15");
                        await expectMainMutedTextContrast(page, `${path} at ${viewport.width}px`);
                    }
                }
            });
        }
    }

    test("keeps detail, ranking, and image-less shelf labels legible in Japanese and English", async ({ page }) => {
        await mockVNDB(page);
        await page.goto("/");

        const fixtureVNs = fixture.vns as unknown as Record<string, VN>;
        const imageLessVN = structuredClone(fixtureVNs.v4);
        imageLessVN.image = null;
        await seedLibraryItem(page, "v1", { status: "playing", score: 0 });
        await seedLibraryItem(page, "v4", { vn: imageLessVN, status: "completed", score: 0 });
        await page.reload();

        for (const language of ["ja", "en"] as const) {
            if (language === "en") await page.getByRole("button", { name: "EN", exact: true }).click();

            await page.goto("/vn/v1");
            await page.getByRole("button", { name: language === "ja" ? "作品情報を見る" : "View title information", exact: true }).click();
            await openAdditionalRecordFields(page);
            await expectReadableText(page.getByTestId("detail-score-suffix"), `${language} detail /100 label`);
            await expectReadableText(page.getByTestId("detail-legacy-score-note"), `${language} legacy zero-score note`);
            await expectReadableText(page.getByTestId("detail-vndb-score-suffix"), `${language} VNDB score label`);
            await expectDiscernibleUI(page.getByTestId("detail-tags-icon"), `${language} tags/developer icon`);

            await page.goto("/ranking");
            const firstRankedItem = page.locator('a[href="/vn/v1"]');
            await expectReadableText(firstRankedItem.getByTestId("ranking-rank"), `${language} ranking position`);
            await expectReadableText(firstRankedItem.getByTestId("ranking-status"), `${language} ranking status`);
            await expectReadableText(firstRankedItem.getByTestId("ranking-score-label"), `${language} ranking score label`);

            await page.goto("/?view=shelf");
            await expectReadableText(page.getByTestId("shelf-no-image-label"), `${language} image-less shelf label`);
            await expect(page.getByTestId("shelf-no-image-label")).toHaveText(language === "ja" ? "画像なし" : "No image");
        }
    });

    test("keeps Japanese and English settings text and controls legible with backgrounds on and off", async ({ page }) => {
        await page.addInitScript((background) => localStorage.setItem("vn-manager-bg", background), BRIGHT_BACKGROUND);
        await page.goto("/settings");

        await expectSettingsContrast(page, "ja");
        const blurSwitch = page.locator("#settings-nsfw-blur");
        const blurSwitchColors = await blurSwitch.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            const surface = element.closest<HTMLElement>('[data-testid="settings-display-options"]');
            return {
                width: rect.width,
                height: rect.height,
                rootBackground: getComputedStyle(element).backgroundColor,
                track: getComputedStyle(element, "::before").backgroundColor,
                surface: surface ? getComputedStyle(surface).backgroundColor : "",
            };
        });
        expect(blurSwitchColors.width).toBeGreaterThanOrEqual(44);
        expect(blurSwitchColors.height).toBeGreaterThanOrEqual(44);
        expect(blurSwitchColors.rootBackground).toBe("rgba(0, 0, 0, 0)");
        expect(contrastRatio(blurSwitchColors.track, blurSwitchColors.surface), "checked image-blur switch").toBeGreaterThanOrEqual(3);
        await page.goto("/search");
        await expectSearchInputContrast(page, "ja");
        await page.goto("/settings");
        await page.getByRole("button", { name: "英語", exact: true }).click();
        await expectSettingsContrast(page, "en");
        await page.goto("/search");
        await expectSearchInputContrast(page, "en");
        await page.goto("/settings");

        await page.getByRole("button", { name: "Remove background image", exact: true }).click();
        await expect(page.locator("[style*='background-image']")).toHaveCount(0);
        // Disabled controls are exempt from the contrast threshold and are deliberately not measured.
        await expect(page.getByRole("button", { name: "Remove background image", exact: true })).toBeDisabled();
        await expectSettingsContrast(page, "en");
        await page.goto("/search");
        await expectSearchInputContrast(page, "en");
        await page.goto("/settings");
        await page.getByRole("button", { name: "Japanese", exact: true }).click();
        await expectSettingsContrast(page, "ja");
        await page.goto("/search");
        await expectSearchInputContrast(page, "ja");
    });

    test("keeps settings descriptions readable over a dark background image in both languages", async ({ page }) => {
        await page.addInitScript((background) => localStorage.setItem("vn-manager-bg", background), DARK_BACKGROUND);
        await page.goto("/settings");

        await expectSettingsContrast(page, "ja", [0, 0, 0]);
        await page.getByRole("button", { name: "英語", exact: true }).click();
        await expectSettingsContrast(page, "en", [0, 0, 0]);
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

    test("keeps the numeric score and unrated action keyboard accessible", async ({ page }) => {
        await mockVNDB(page);
        await page.goto("/vn/v1");

        const score = page.getByRole("spinbutton", { name: "スコア", exact: true });
        await expect(score).toBeVisible();
        const scoreBox = await score.boundingBox();
        expect(scoreBox).not.toBeNull();
        expect(scoreBox!.height).toBeGreaterThanOrEqual(44);
        await score.fill("79");
        await score.focus();
        await page.keyboard.press("ArrowUp");
        await expect(score).toHaveValue("80");

        const markUnrated = page.getByRole("button", { name: "未評価に戻す", exact: true });
        const markUnratedBox = await markUnrated.boundingBox();
        expect(markUnratedBox).not.toBeNull();
        expect(markUnratedBox!.height).toBeGreaterThanOrEqual(44);
        await markUnrated.focus();
        await page.keyboard.press("Enter");
        await expect(score).toHaveValue("");
    });

    test("keeps desktop status tabs and mobile status select operable", async ({ page }) => {
        await mockVNDB(page);
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.goto("/");
        await seedLibraryItem(page, "v1");
        await page.reload();

        const tabs = page.locator('[data-slot="tabs-trigger"]');
        await expect(tabs).toHaveCount(4);
        for (const tab of await tabs.all()) {
            const box = await tab.boundingBox();
            expect(box).not.toBeNull();
            expect(box!.height).toBeGreaterThanOrEqual(44);
        }

        const inactiveTab = page.locator('[data-slot="tabs-trigger"][data-state="inactive"]').first();
        const tabCount = inactiveTab.locator("span");
        const countColors = await tabCount.evaluate((element) => ({
            foreground: getComputedStyle(element).color,
            background: getComputedStyle(element.parentElement!).backgroundColor,
            opacity: getComputedStyle(element).opacity,
        }));
        expect(countColors.opacity).toBe("1");
        expect(contrastRatio(countColors.foreground, countColors.background), "inactive status tab count").toBeGreaterThanOrEqual(4.5);

        await page.setViewportSize({ width: 390, height: 844 });
        await expect(page.locator('[data-slot="tabs-list"]')).toBeHidden();
        const statusSelect = page.getByRole("combobox", { name: "ステータス", exact: true });
        await expect(statusSelect).toBeVisible();
        const statusSelectBox = await statusSelect.boundingBox();
        expect(statusSelectBox).not.toBeNull();
        expect(statusSelectBox!.height).toBeGreaterThanOrEqual(44);

        await statusSelect.click();
        const options = page.getByRole("option");
        await expect(options.first()).toBeVisible();
        await expect(options).toHaveCount(7);
        await expect.poll(async () => (await options.first().boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
        for (const option of await options.all()) {
            const box = await option.boundingBox();
            expect(box).not.toBeNull();
            expect(box!.height).toBeGreaterThanOrEqual(44);
        }
        await page.getByRole("option", { name: "プレイ中", exact: true }).click();
        await expect(page).toHaveURL(/status=playing/);
    });

    test("shows keyboard focus on the Markdown textarea without removing its scroll margin", async ({ page }) => {
        await mockVNDB(page);
        await page.goto("/vn/v1");
        await page.getByTestId("detail-notes-section").locator("summary").click();

        const textarea = page.locator("#detail-notes");
        await expect(textarea).toBeVisible();
        await expect.poll(() => textarea.evaluate((element) => getComputedStyle(element).fontFamily)).not.toMatch(/monospace|Geist Mono/i);
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
        const textareaBackground = (await renderedColors(textarea)).background;
        expect(contrastRatio(focusStyle.outlineColor, textareaBackground), "Markdown keyboard focus outline").toBeGreaterThanOrEqual(3);

        const editor = textarea.locator("xpath=..");
        const editorBoundary = await editor.evaluate((element) => ({
            border: getComputedStyle(element).borderTopColor,
            background: getComputedStyle(element).backgroundColor,
        }));
        expect(contrastRatio(editorBoundary.border, editorBoundary.background), "Markdown editor boundary").toBeGreaterThanOrEqual(3);
    });

    test("respects reduced motion for decorative roulette and CSS animation", async ({ page }) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await mockVNDB(page);
        await page.goto("/");
        await seedLibraryItem(page, "v1");
        await page.reload();

        await page.getByRole("button", { name: "次に遊ぶ作品を選ぶ", exact: true }).click();
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
