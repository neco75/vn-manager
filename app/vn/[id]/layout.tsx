import { Metadata } from "next";
import { getVNMetadataById } from "@/lib/vndb";
import { getVisibleSynopsisText } from "@/lib/spoiler-safety";

type Props = {
    params: Promise<{ id: string }>;
    children: React.ReactNode;
};

export async function generateMetadata(
    { params }: Props
): Promise<Metadata> {
    const id = (await params).id;

    try {
        const vn = await getVNMetadataById(id);

        if (!vn) {
            return {
                title: "Visual Novel",
                description: "Visual novel details in VN Manager.",
            };
        }

        const description = getVisibleSynopsisText(vn.description).slice(0, 160) || `Details about ${vn.title}`;
        return {
            title: vn.title,
            description,
            openGraph: {
                title: vn.title,
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
