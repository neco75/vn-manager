import { fireEvent, render, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/context/LanguageContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { VNCard } from "@/components/VNCard";
import type { LibraryItem } from "@/types/library";
import type { VN } from "@/types/vndb";

const vn: VN = {
    id: "v1",
    title: "Test Visual Novel",
    released: "2020-01-01",
    languages: ["ja"],
    platforms: ["win"],
    image: null,
    description: "",
    rating: 80,
    votecount: 100,
    length_minutes: 120,
    tags: [],
    developers: [{ id: "d1", name: "Test Works", original: "" }],
    screenshots: [],
    extlinks: [],
    releases: [],
};

const libraryItem: LibraryItem = {
    recordVersion: 2,
    vn,
    status: "completed",
    ownership: "owned",
    score: 0,
    notes: "",
    addedAt: 1,
    updatedAt: 1,
};

function renderCard(props: Partial<React.ComponentProps<typeof VNCard>> = {}) {
    return render(
        <LanguageProvider>
            <SettingsProvider>
                <VNCard vn={vn} variant="search" {...props} />
            </SettingsProvider>
        </LanguageProvider>,
    );
}

describe("VNCard search variant", () => {
    it("keeps one detail link separate from the add button", () => {
        const onAdd = vi.fn();
        const onDetailClick = vi.fn();
        const { container } = renderCard({ onAdd, onDetailClick, detailHref: "/vn/v1?from=%2Fsearch" });
        const card = container.querySelector('[data-slot="card"]');

        expect(card).not.toBeNull();
        expect(within(card as HTMLElement).getAllByRole("link", { name: vn.title })).toHaveLength(1);
        expect(within(card as HTMLElement).getByText("VNDB 8.0/10", { exact: true })).toBeVisible();
        const addButton = within(card as HTMLElement).getByRole("button", { name: "ライブラリに追加" });
        expect(addButton.closest("a")).toBeNull();

        fireEvent.click(addButton);
        expect(onAdd).toHaveBeenCalledTimes(1);
        expect(onDetailClick).not.toHaveBeenCalled();

        fireEvent.click(within(card as HTMLElement).getByRole("link", { name: vn.title }));
        expect(onDetailClick).toHaveBeenCalledTimes(1);
    });

    it("disables the add operation while a search result is being added", () => {
        const { container } = renderCard({ onAdd: vi.fn(), isAdding: true });
        const card = container.querySelector('[data-slot="card"]');
        const addButton = within(card as HTMLElement).getByRole("button", { name: "ライブラリに追加" });

        expect(addButton).toBeDisabled();
        expect(addButton).toHaveAttribute("aria-busy", "true");
    });

    it("shows registered state without another add button", () => {
        renderCard({ libraryItem });

        const card = document.querySelector('[data-slot="card"]');
        expect(card).not.toBeNull();
        expect(within(card as HTMLElement).getByText("登録済み", { exact: true })).toBeVisible();
        expect(within(card as HTMLElement).queryByRole("button", { name: "ライブラリに追加" })).not.toBeInTheDocument();
    });

    it("uses the Japanese title for the accessible detail link", () => {
        const localizedVN = {
            ...vn,
            titles: [{ lang: "ja", title: "日本語タイトル", latin: "Japanese title" }],
        };
        const { container } = renderCard({ vn: localizedVN });
        const card = container.querySelector('[data-slot="card"]');

        expect(card).not.toBeNull();
        expect(within(card as HTMLElement).getAllByRole("link", { name: "日本語タイトル" })).toHaveLength(1);
    });
});

describe("VNCard library variant", () => {
    it.each([
        { score: 0, label: "0/100" },
        { score: null, label: "未評価" },
        { score: 100, label: "100/100" },
    ])("uses one full-card link and distinguishes score $label", ({ score, label }) => {
        const { container } = renderCard({
            variant: "library",
            libraryItem: { ...libraryItem, score },
            detailHref: "/vn/v1?from=%2F",
        });
        const link = within(container).getByRole("link", { name: vn.title });

        expect(container.querySelectorAll("a")).toHaveLength(1);
        expect(link).toHaveAttribute("href", "/vn/v1?from=%2F");
        expect(within(link).getByText("Test Works")).toBeVisible();
        expect(within(link).getByText(label, { exact: true })).toBeVisible();
        expect(within(link).getByText("クリア済み", { exact: true })).toBeVisible();
        expect(within(link).getByText("画像なし", { exact: true })).toBeVisible();
        expect(within(link).queryByText(/VNDB/)).not.toBeInTheDocument();
        expect(within(link).queryByText("所有済み", { exact: true })).not.toBeInTheDocument();
        expect(within(link).queryByRole("button")).not.toBeInTheDocument();
    });

    it("keeps the full localized title as the link name when text is clamped", () => {
        const longJapaneseTitle = "日本語の長いタイトル 続編 ファンディスク";
        const longBrand = "日本語の長いブランド名で一行を超えることを確認";
        const localizedVN: VN = {
            ...vn,
            title: "Long Romanized Sequel Fan Disc Title",
            titles: [{ lang: "ja", title: longJapaneseTitle, latin: "Japanese Long Sequel Fan Disc Title" }],
            developers: [{ id: "d1", name: longBrand, original: "" }],
        };
        const { container } = renderCard({ vn: localizedVN, variant: "library", libraryItem });
        const link = within(container).getByRole("link", { name: longJapaneseTitle });
        const brand = link.querySelector("span.truncate");

        expect(link).toBeVisible();
        expect(link.querySelector("span.line-clamp-2")).toHaveTextContent(longJapaneseTitle);
        expect(brand).toHaveTextContent(longBrand);
        expect(brand).toHaveClass("truncate");
    });

    it("falls back in the same cover frame after an image fails and keeps unknown sexual values blurred", () => {
        const imageVN: VN = {
            ...vn,
            image: { id: "i1", url: "https://t.vndb.org/1/cover.jpg", dims: [600, 900] },
        };
        const { container } = renderCard({ vn: imageVN, variant: "library", libraryItem });
        const link = within(container).getByRole("link", { name: vn.title });
        const image = link.querySelector("img");
        const cover = image?.parentElement;

        expect(image).toHaveClass("blur-xl", "object-contain");
        expect(cover).toHaveClass("aspect-[3/2]");

        fireEvent.error(image as HTMLImageElement);

        expect(link.querySelector("img")).toBeNull();
        expect(link).toHaveAccessibleName(vn.title);
        expect(within(link).getByText("画像なし", { exact: true })).toBeVisible();
        expect(Array.from(link.querySelectorAll("div")).some((element) => element.className.includes("aspect-[3/2]"))).toBe(true);
    });
});
