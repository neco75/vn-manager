"use client";

import { motion } from "framer-motion";
import { BookOpen, Database, Github, Globe, Laptop, Shield, Star, Trophy, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion } from "@/components/Accordion";
import { useLanguage } from "@/context/LanguageContext";

export default function AboutPage() {
    const { t } = useLanguage();

    return (
        <div className="max-w-4xl mx-auto pb-20 space-y-12">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center space-y-4"
            >
                <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
                    {t.about.title}
                </h1>
                <p className="text-xl text-gray-400">
                    {t.about.subtitle}
                </p>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="grid md:grid-cols-2 gap-6"
            >
                <div className="bg-card border border-white/10 rounded-xl p-6 space-y-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                        <Database className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold">{t.about.vndb_title}</h3>
                    <p className="text-gray-400">
                        {t.about.vndb_desc}
                    </p>
                </div>

                <div className="bg-card border border-white/10 rounded-xl p-6 space-y-4">
                    <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center">
                        <Shield className="w-6 h-6 text-accent" />
                    </div>
                    <h3 className="text-xl font-bold">{t.about.privacy_title}</h3>
                    <p className="text-gray-400">
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
                    <Laptop className="w-6 h-6 text-blue-400" />
                    {t.about.usage_title}
                </h2>

                <div className="space-y-4">
                    <Accordion title={t.about.web_usage_title} defaultOpen>
                        <div className="space-y-4 text-gray-300">
                            <p>
                                {t.about.web_usage_desc}
                            </p>
                            <ul className="list-disc list-inside space-y-2 ml-4">
                                <li>
                                    <span className="font-bold text-white">{t.about.web_usage_point1_label}</span> {t.about.web_usage_point1_text}
                                </li>
                                <li>
                                    <span className="font-bold text-white">{t.about.web_usage_point2_label}</span> {t.about.web_usage_point2_text}
                                </li>
                                <li>
                                    <span className="font-bold text-white">{t.about.web_usage_point3_label}</span> {t.about.web_usage_point3_text}
                                </li>
                            </ul>
                        </div>
                    </Accordion>

                    <Accordion title={t.about.local_usage_title}>
                        <div className="space-y-4 text-gray-300">
                            <p>
                                {t.about.local_usage_desc}
                            </p>
                            <div className="bg-black/30 p-4 rounded-lg font-mono text-sm">
                                <p className="text-gray-500">{t.about.local_usage_clone}</p>
                                <p>git clone https://github.com/your-username/vn-manager.git</p>
                                <p className="mt-2 text-gray-500">{t.about.local_usage_install}</p>
                                <p>npm install</p>
                                <p className="mt-2 text-gray-500">{t.about.local_usage_run}</p>
                                <p>npm run dev</p>
                            </div>
                            <p>
                                {t.about.local_usage_refer}
                            </p>
                            <Button variant="outline" className="gap-2 mt-2" asChild>
                                <a href="https://github.com" target="_blank" rel="noopener noreferrer">
                                    <Github className="w-4 h-4" />
                                    {t.about.github_button}
                                </a>
                            </Button>
                        </div>
                    </Accordion>
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="space-y-6"
            >
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Trophy className="w-6 h-6 text-yellow-500" />
                    {t.about.features_title}
                </h2>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {t.about.features.map((feature) => (
                        <div key={feature} className="bg-secondary/30 border border-white/5 rounded-lg p-3 flex items-center gap-2">
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
                className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-xl p-6 flex items-start gap-4"
            >
                <div className="p-3 rounded-full bg-purple-500/20">
                    <Sparkles className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-purple-200 mb-1">{t.about.ai_credit_title}</h3>
                    <p className="text-gray-400">
                        {t.about.ai_credit_desc}
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
