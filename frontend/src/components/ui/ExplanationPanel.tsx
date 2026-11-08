"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Contribution } from "@/lib/types";

interface ExplanationPanelProps {
  contributions: Contribution[];
  homeTeam: string;
  awayTeam: string;
}

/**
 * "Why this prediction" — the features that moved the number, largest first.
 *
 * Impact is in probability points. Positive favors the home team, so the bar
 * grows right for home and left for away, which makes the direction readable
 * without reading the sign.
 */
export function ExplanationPanel({
  contributions,
  homeTeam,
  awayTeam,
}: ExplanationPanelProps) {
  const [open, setOpen] = useState(false);

  if (!contributions || contributions.length === 0) return null;

  const maxAbs = Math.max(...contributions.map((c) => Math.abs(c.impact)), 0.001);

  return (
    <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-[11px] font-medium text-zinc-500 transition-colors hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        <span>Why this prediction</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-3">
              <div className="mb-2 flex items-center justify-between text-[9px] font-semibold uppercase tracking-wider text-zinc-400">
                <span>{homeTeam} favored</span>
                <span>{awayTeam} favored</span>
              </div>

              <ul className="flex flex-col gap-1.5">
                {contributions.map((c) => {
                  const pct = (Math.abs(c.impact) / maxAbs) * 50;
                  const favorsHome = c.impact > 0;
                  return (
                    <li key={c.feature} className="flex items-center gap-2">
                      <span
                        className="w-[46%] shrink-0 truncate text-[11px] text-zinc-600 dark:text-zinc-300"
                        title={`${c.label} = ${c.value}`}
                      >
                        {c.label}
                      </span>
                      <div className="relative flex h-3 flex-1 items-center">
                        <div className="absolute inset-y-0 left-1/2 w-px bg-zinc-200 dark:bg-zinc-700" />
                        <div
                          className={`absolute h-2 rounded-sm ${
                            favorsHome
                              ? "left-1/2 bg-emerald-500/80 dark:bg-emerald-400/80"
                              : "right-1/2 bg-rose-500/80 dark:bg-rose-400/80"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-11 shrink-0 text-right text-[10px] font-medium tabular-nums text-zinc-500 dark:text-zinc-400">
                        {c.impact > 0 ? "+" : ""}
                        {(c.impact * 100).toFixed(1)}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <p className="mt-2.5 text-[10px] leading-relaxed text-zinc-400">
                Probability points contributed by each feature (tree SHAP). The
                model&apos;s baseline is the average home-win rate across
                training data.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
