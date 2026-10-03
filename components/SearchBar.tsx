import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface SearchBarProps extends React.InputHTMLAttributes<HTMLInputElement> {
    className?: string;
}

export function SearchBar({ className, ...props }: SearchBarProps) {
    return (
        <div className={cn("relative", className)}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" aria-hidden="true" />
            <Input
                {...props}
                className="pl-10"
            />
        </div>
    );
}
