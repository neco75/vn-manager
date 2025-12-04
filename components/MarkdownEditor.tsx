"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";

import {
    Bold,
    Italic,
    Strikethrough,
    List,
    ListOrdered,
    Heading1,
    Heading2,
    Heading3,
    Quote,
    Code,
    Link as LinkIcon,
    Image as ImageIcon,
} from "lucide-react";
import { useRef } from "react";

interface MarkdownEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    height?: string;
}

export function MarkdownEditor({
    value,
    onChange,
    placeholder,
    className,
    height = "h-80"
}: MarkdownEditorProps) {
    const [activeTab, setActiveTab] = useState<"write" | "preview">("write");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const insertText = (before: string, after: string = "") => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = value.substring(start, end);
        const newText = value.substring(0, start) + before + selectedText + after + value.substring(end);

        onChange(newText);

        // Restore selection / cursor position
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + before.length, end + before.length);
        }, 0);
    };

    return (
        <div className={cn("flex flex-col border border-white/10 rounded-md bg-secondary/30 overflow-hidden", className)}>
            <div className="flex items-center border-b border-white/10 bg-secondary/20 px-2">
                <button
                    onClick={() => setActiveTab("write")}
                    className={cn(
                        "px-4 py-2 text-sm font-medium transition-colors border-b-2",
                        activeTab === "write"
                            ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                >
                    Write
                </button>
                <button
                    onClick={() => setActiveTab("preview")}
                    className={cn(
                        "px-4 py-2 text-sm font-medium transition-colors border-b-2",
                        activeTab === "preview"
                            ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                >
                    Preview
                </button>
            </div>

            {activeTab === "write" ? (
                <>
                    <div className="flex flex-wrap gap-1 p-2 border-b border-white/10 bg-secondary/20">
                        <button onClick={() => insertText("**", "**")} className="p-2 rounded hover:bg-white/10 text-muted-foreground hover:text-primary transition-colors" title="Bold">
                            <Bold className="w-4 h-4" />
                        </button>
                        <button onClick={() => insertText("*", "*")} className="p-2 rounded hover:bg-white/10 text-muted-foreground hover:text-primary transition-colors" title="Italic">
                            <Italic className="w-4 h-4" />
                        </button>
                        <button onClick={() => insertText("~~", "~~")} className="p-2 rounded hover:bg-white/10 text-muted-foreground hover:text-primary transition-colors" title="Strikethrough">
                            <Strikethrough className="w-4 h-4" />
                        </button>
                        <div className="w-px h-6 bg-white/10 mx-1 self-center" />
                        <button onClick={() => insertText("# ")} className="p-2 rounded hover:bg-white/10 text-muted-foreground hover:text-primary transition-colors" title="Heading 1">
                            <Heading1 className="w-4 h-4" />
                        </button>
                        <button onClick={() => insertText("## ")} className="p-2 rounded hover:bg-white/10 text-muted-foreground hover:text-primary transition-colors" title="Heading 2">
                            <Heading2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => insertText("### ")} className="p-2 rounded hover:bg-white/10 text-muted-foreground hover:text-primary transition-colors" title="Heading 3">
                            <Heading3 className="w-4 h-4" />
                        </button>
                        <div className="w-px h-6 bg-white/10 mx-1 self-center" />
                        <button onClick={() => insertText("- ")} className="p-2 rounded hover:bg-white/10 text-muted-foreground hover:text-primary transition-colors" title="Bullet List">
                            <List className="w-4 h-4" />
                        </button>
                        <button onClick={() => insertText("1. ")} className="p-2 rounded hover:bg-white/10 text-muted-foreground hover:text-primary transition-colors" title="Ordered List">
                            <ListOrdered className="w-4 h-4" />
                        </button>
                        <div className="w-px h-6 bg-white/10 mx-1 self-center" />
                        <button onClick={() => insertText("> ")} className="p-2 rounded hover:bg-white/10 text-muted-foreground hover:text-primary transition-colors" title="Blockquote">
                            <Quote className="w-4 h-4" />
                        </button>
                        <button onClick={() => insertText("```\n", "\n```")} className="p-2 rounded hover:bg-white/10 text-muted-foreground hover:text-primary transition-colors" title="Code Block">
                            <Code className="w-4 h-4" />
                        </button>
                        <div className="w-px h-6 bg-white/10 mx-1 self-center" />
                        <button onClick={() => insertText("[", "](url)")} className="p-2 rounded hover:bg-white/10 text-muted-foreground hover:text-primary transition-colors" title="Link">
                            <LinkIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => insertText("![alt](", ")")} className="p-2 rounded hover:bg-white/10 text-muted-foreground hover:text-primary transition-colors" title="Image">
                            <ImageIcon className="w-4 h-4" />
                        </button>
                    </div>
                    <textarea
                        ref={textareaRef}
                        className={cn("w-full h-full p-4 bg-transparent focus:outline-none resize-none font-mono text-sm leading-relaxed", height)}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={placeholder}
                    />
                </>
            ) : (
                <div className={cn("w-full p-4 overflow-y-auto prose prose-invert max-w-none", height)}>
                    <ReactMarkdown>{value}</ReactMarkdown>
                </div>
            )}
        </div>
    );
}
