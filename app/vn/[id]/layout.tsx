import { Metadata } from "next";
import { getVNById } from "@/lib/vndb";

type Props = {
    params: Promise<{ id: string }>;
    children: React.ReactNode;
};

export async function generateMetadata(
    { params }: Props
): Promise<Metadata> {
    const id = (await params).id;
    const vn = await getVNById(id);

    if (!vn) {
        return {
            title: "VN Not Found",
            description: "The requested visual novel could not be found.",
        };
    }

    return {
        title: vn.title,
        description: vn.description?.slice(0, 160).replace(/\[.*?\]/g, "") || `Details about ${vn.title}`,
        openGraph: {
            title: vn.title,
            description: vn.description?.slice(0, 160).replace(/\[.*?\]/g, "") || `Details about ${vn.title}`,
            images: vn.image ? [{ url: vn.image.url }] : [],
        },
    };
}

export default function VNLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
