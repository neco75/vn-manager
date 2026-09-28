"use client";

import { motion, useReducedMotion } from "framer-motion";

export default function PageTransition({
    children,
}: {
    children: React.ReactNode;
}) {
    const reduceMotion = useReducedMotion();

    return (
        <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: 20 }}
            transition={{ duration: reduceMotion ? 0 : 0.3, ease: "easeOut" }}
        >
            {children}
        </motion.div>
    );
}
