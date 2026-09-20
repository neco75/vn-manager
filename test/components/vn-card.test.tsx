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
    developers: [],
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
    it("keeps the detail links separate from the add button", () => {
        const onAdd = vi.fn();
        const { container } = renderCard({ onAdd });
        const card = container.querySelector('[data-slot="card"]');

        expect(card).not.toBeNull();
        expect(within(card as HTMLElement).getAllByRole("link", { name: vn.title })).toHaveLength(2);
        const addButton = within(card as HTMLElement).getByRole("button", { name: "ライブラリに追加" });
        expect(addButton.closest("a")).toBeNull();

        fireEvent.click(addButton);
        expect(onAdd).toHaveBeenCalledTimes(1);
    });

    it("shows registered state without another add button", () => {
        renderCard({ libraryItem });

        const card = document.querySelector('[data-slot="card"]');
        expect(card).not.toBeNull();
        expect(within(card as HTMLElement).queryAllByText("登録済み").length).toBeGreaterThan(0);
        expect(within(card as HTMLElement).queryByRole("button", { name: "ライブラリに追加" })).not.toBeInTheDocument();
    });
});
