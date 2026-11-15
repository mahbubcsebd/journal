"use client";

import { motion } from "motion/react";

/** Gentle page-in on every navigation, like a native app screen change. */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </motion.div>
  );
}
