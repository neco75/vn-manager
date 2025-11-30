import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchBarProps extends React.InputHTMLAttributes<HTMLInputElement> {
    className?: string;
}

export function SearchBar({ className, ...props }: SearchBarProps) {
    return (
        <div className={cn("relative", className)}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
                type="text"
                className="w-full bg-secondary/50 border border-white/10 rounded-full py-3 pl-10 pr-4 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                placeholder="タイトルで検索..."
                {...props}
            />
        </div>
    );
}
