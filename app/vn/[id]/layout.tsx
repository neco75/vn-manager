import { Metadata } from "next";
import { getVNMetadataById } from "@/lib/vndb";
import { getVisibleSynopsisText } from "@/lib/spoiler-safety";
import { getDisplayTitle } from "@/lib/vndb-title";

type Props = {
    params: Promise<{ id: string }>;
    children: React.ReactNode;
};

export async function generateMetadata(
    { params }: Props
): Promise<Metadata> {
    const id = (await params).id;

    try {
        const vn = await getVNMetadataById(id, { apiUrl: process.env.VNDB_API_URL });

        if (!vn) {
            return {
                title: "Visual Novel",
                description: "Visual novel details in VN Manager.",
            };
        }

        const displayTitle = getDisplayTitle(vn, "ja");
        const description = getVisibleSynopsisText(vn.description).slice(0, 160) || `Details about ${displayTitle}`;
        return {
            title: displayTitle,
            description,
            openGraph: {
                title: displayTitle,
                description,
                images: vn.image ? [{ url: vn.image.url }] : [],
            },
        };
    } catch (error) {
        console.error("Failed to fetch VN metadata:", error);
        return {
            title: "Visual Novel",
            description: "Visual novel details in VN Manager.",
        };
    }
}

export default function VNLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
