"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { useLanguage } from "@/context/LanguageContext";

import {
    Bold,
    Italic,
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
    ariaLabel?: string;
    id?: string;
    disabled?: boolean;
}

export function MarkdownEditor({
    value,
    onChange,
    placeholder,
    className,
    height = "h-80",
    ariaLabel,
    id,
    disabled = false,
}: MarkdownEditorProps) {
    const [activeTab, setActiveTab] = useState<"write" | "preview">("write");
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const { t } = useLanguage();

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
        <div className={cn("flex flex-col overflow-hidden rounded-lg border border-input bg-card", className)}>
            <div className="flex items-center border-b border-border bg-secondary px-2">
                <button
                    type="button"
                    onClick={() => setActiveTab("write")}
                    aria-pressed={activeTab === "write"}
                    disabled={disabled}
                    className={cn(
                        "min-h-11 px-4 py-2 text-sm font-medium transition-colors border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        activeTab === "write"
                            ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                >
                    {t.common.markdownWrite}
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab("preview")}
                    aria-pressed={activeTab === "preview"}
                    disabled={disabled}
                    className={cn(
                        "min-h-11 px-4 py-2 text-sm font-medium transition-colors border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        activeTab === "preview"
                            ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                >
                    {t.common.markdownPreview}
                </button>
            </div>

            {activeTab === "write" ? (
                <>
                    <div className="flex flex-wrap gap-1 border-b border-border bg-secondary p-2">
                        <button type="button" disabled={disabled} onClick={() => insertText("**", "**")} className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" title={t.common.markdownBold} aria-label={t.common.markdownBold}>
                            <Bold className="w-4 h-4" />
                        </button>
                        <button type="button" disabled={disabled} onClick={() => insertText("*", "*")} className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" title={t.common.markdownItalic} aria-label={t.common.markdownItalic}>
                            <Italic className="w-4 h-4" />
                        </button>
                        <div className="my-auto mx-1 h-6 w-px bg-border" />
                        <button type="button" disabled={disabled} onClick={() => insertText("# ")} className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" title={t.common.markdownHeading1} aria-label={t.common.markdownHeading1}>
                            <Heading1 className="w-4 h-4" />
                        </button>
                        <button type="button" disabled={disabled} onClick={() => insertText("## ")} className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" title={t.common.markdownHeading2} aria-label={t.common.markdownHeading2}>
                            <Heading2 className="w-4 h-4" />
                        </button>
                        <button type="button" disabled={disabled} onClick={() => insertText("### ")} className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" title={t.common.markdownHeading3} aria-label={t.common.markdownHeading3}>
                            <Heading3 className="w-4 h-4" />
                        </button>
                        <div className="my-auto mx-1 h-6 w-px bg-border" />
                        <button type="button" disabled={disabled} onClick={() => insertText("- ")} className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" title={t.common.markdownBulletList} aria-label={t.common.markdownBulletList}>
                            <List className="w-4 h-4" />
                        </button>
                        <button type="button" disabled={disabled} onClick={() => insertText("1. ")} className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" title={t.common.markdownOrderedList} aria-label={t.common.markdownOrderedList}>
                            <ListOrdered className="w-4 h-4" />
                        </button>
                        <div className="my-auto mx-1 h-6 w-px bg-border" />
                        <button type="button" disabled={disabled} onClick={() => insertText("> ")} className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" title={t.common.markdownBlockquote} aria-label={t.common.markdownBlockquote}>
                            <Quote className="w-4 h-4" />
                        </button>
                        <button type="button" disabled={disabled} onClick={() => insertText("```\n", "\n```")} className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" title={t.common.markdownCodeBlock} aria-label={t.common.markdownCodeBlock}>
                            <Code className="w-4 h-4" />
                        </button>
                        <div className="my-auto mx-1 h-6 w-px bg-border" />
                        <button type="button" disabled={disabled} onClick={() => insertText("[", "](url)")} className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" title={t.common.markdownLink} aria-label={t.common.markdownLink}>
                            <LinkIcon className="w-4 h-4" />
                        </button>
                        <button type="button" disabled={disabled} onClick={() => insertText("![alt](", ")")} className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" title={t.common.markdownImage} aria-label={t.common.markdownImage}>
                            <ImageIcon className="w-4 h-4" />
                        </button>
                    </div>
                    <textarea
                        ref={textareaRef}
                        id={id}
                        className={cn("w-full h-full scroll-mt-56 bg-card p-4 font-sans text-base leading-relaxed text-foreground placeholder:text-muted-foreground selection:bg-selection selection:text-selection-foreground focus:outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-[-3px] resize-none sm:scroll-mt-36", height)}
                        value={value}
                        disabled={disabled}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={placeholder}
                        aria-label={ariaLabel}
                    />
                </>
            ) : (
                <div className={cn("w-full p-4 overflow-y-auto prose prose-slate max-w-none", height)}>
                    <ReactMarkdown>{value}</ReactMarkdown>
                </div>
            )}
        </div>
    );
}
