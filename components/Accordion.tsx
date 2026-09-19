"use client";

import { useId, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccordionProps {
    title: React.ReactNode;
    children: React.ReactNode;
    defaultOpen?: boolean;
    className?: string;
}

export function Accordion({ title, children, defaultOpen = false, className }: AccordionProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const id = useId();
    const triggerId = `${id}-trigger`;
    const contentId = `${id}-content`;

    return (
        <div className={cn("border border-white/10 rounded-xl overflow-hidden bg-card", className)}>
            <button
                id={triggerId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={contentId}
                onClick={() => setIsOpen(!isOpen)}
                className="w-full min-h-11 flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
            >
                <div className="font-bold text-lg">{title}</div>
                <ChevronDown
                    aria-hidden="true"
                    className={cn("w-5 h-5 shrink-0 transition-transform duration-200", isOpen && "rotate-180")}
                />
            </button>
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        id={contentId}
                        role="region"
                        aria-labelledby={triggerId}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <div className="p-4 pt-0 border-t border-white/5">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
