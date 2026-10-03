"use client";

import { useId, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
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
    const reduceMotion = useReducedMotion();
    const id = useId();
    const triggerId = `${id}-trigger`;
    const contentId = `${id}-content`;

    return (
        <div className={cn("overflow-hidden rounded-xl border border-border bg-card", className)}>
            <button
                id={triggerId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={contentId}
                onClick={() => setIsOpen(!isOpen)}
                className="flex min-h-11 w-full items-center justify-between p-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                        initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
                        transition={{ duration: reduceMotion ? 0 : 0.2 }}
                    >
                        <div className="border-t border-border p-4 pt-0">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
