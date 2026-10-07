"use client";

import { motion } from "framer-motion";
import { Database, ExternalLink, Laptop, Shield, Star, Trophy, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion } from "@/components/Accordion";
import { useLanguage } from "@/context/LanguageContext";

export default function AboutPage() {
    const { t } = useLanguage();

    return (
        <div className="mx-auto max-w-[760px] space-y-8 pb-20">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2 text-left"
            >
                <h1 className="text-3xl font-bold text-foreground">
                    {t.about.title}
                </h1>
                <p className="text-base text-muted-foreground">
                    {t.about.subtitle}
                </p>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="grid gap-6"
            >
                <div className="space-y-4 rounded-xl border border-border bg-card p-6">
                    <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                        <Database className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold">{t.about.vndb_title}</h3>
                    <p className="text-muted-foreground">
                        {t.about.vndb_desc}
                    </p>
                </div>

                <div className="space-y-4 rounded-xl border border-border bg-card p-6">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Shield className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold">{t.about.privacy_title}</h3>
                    <p className="text-muted-foreground">
                        {t.about.privacy_desc}
                    </p>
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-6"
            >
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Laptop className="w-6 h-6 text-primary" />
                    {t.about.usage_title}
                </h2>

                <div className="space-y-4">
                    <Accordion title={t.about.web_usage_title} defaultOpen>
                        <div className="space-y-4 text-muted-foreground">
                            <p>
                                {t.about.web_usage_desc}
                            </p>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                                <li>
                                    <span className="font-bold text-foreground">{t.about.web_usage_point1_label}</span> {t.about.web_usage_point1_text}
                                </li>
                                <li>
                                    <span className="font-bold text-foreground">{t.about.web_usage_point2_label}</span> {t.about.web_usage_point2_text}
                                </li>
                                <li>
                                    <span className="font-bold text-foreground">{t.about.web_usage_point3_label}</span> {t.about.web_usage_point3_text}
                                </li>
                            </ul>
                        </div>
                    </Accordion>

                    <Accordion title={t.about.local_usage_title}>
                        <div className="space-y-4 text-muted-foreground">
                            <p>
                                {t.about.local_usage_desc}
                            </p>
                            <div className="rounded-lg bg-secondary p-4 font-mono text-sm text-foreground">
                                <p className="text-muted-foreground">{t.about.local_usage_clone}</p>
                                <p>git clone https://github.com/neco75/vn-manager.git</p>
                                <p className="mt-2 text-muted-foreground">{t.about.local_usage_install}</p>
                                <p>npm install</p>
                                <p className="mt-2 text-muted-foreground">{t.about.local_usage_run}</p>
                                <p>npm run dev</p>
                            </div>
                            <p>
                                {t.about.local_usage_refer}
                            </p>
                            <Button variant="outline" className="gap-2 mt-2" asChild>
                                <a href="https://github.com/neco75/vn-manager" target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="w-4 h-4" />
                                    {t.about.github_button}
                                </a>
                            </Button>
                        </div>
                    </Accordion>
                </div>
            </motion.div >

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="space-y-6"
            >
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Trophy className="w-6 h-6 text-primary" />
                    {t.about.features_title}
                </h2>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {t.about.features.map((feature) => (
                        <div key={feature} className="flex items-center gap-2 rounded-lg border border-border bg-secondary p-3">
                            <Star className="w-4 h-4 text-primary" />
                            <span className="text-sm">{feature}</span>
                        </div>
                    ))}
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex items-start gap-4 rounded-xl border border-border bg-secondary p-6"
            >
                <div className="rounded-full bg-primary/10 p-3">
                    <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <div>
                    <h3 className="mb-1 text-lg font-bold text-primary">{t.about.ai_credit_title}</h3>
                    <p className="text-muted-foreground">
                        {t.about.ai_credit_desc}
                    </p>
                </div>
            </motion.div>
        </div >
    );
}
