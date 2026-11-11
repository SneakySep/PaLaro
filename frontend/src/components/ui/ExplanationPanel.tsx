"use client";

import { useId, useState } from "react";
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
  const contentId = useId();

  if (!contributions || contributions.length === 0) return null;

  const maxAbs = Math.max(...contributions.map((c) => Math.abs(c.impact)), 0.001);

  return (
    <div className="mt-4 border-t border-line pt-3.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={contentId}
        className="group flex w-full items-center justify-between rounded-md text-[11.5px] font-medium text-muted transition-colors hover:text-ink"
      >
        <span>Why this prediction</span>
        <span
          className={`inline-flex h-5 w-5 items-center justify-center rounded-full border border-line bg-surface text-muted transition-all group-hover:border-line-strong ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={contentId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-3.5">
              <div className="mb-2 flex items-center justify-between text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted">
                <span>{homeTeam} favored</span>
                <span>{awayTeam} favored</span>
              </div>

              <ul className="flex flex-col gap-2">
                {contributions.map((c) => {
                  const pct = (Math.abs(c.impact) / maxAbs) * 50;
                  const favorsHome = c.impact > 0;
                  return (
                    <li key={c.feature} className="flex items-center gap-2.5">
                      <span
                        className="w-[44%] shrink-0 truncate text-[11px] text-muted"
                        title={`${c.label} = ${c.value}`}
                      >
                        {c.label}
                      </span>
                      <div className="relative flex h-3.5 flex-1 items-center overflow-hidden rounded-full bg-surface-muted/70">
                        <div className="absolute inset-y-0 left-1/2 w-px bg-line-strong" />
                        <div
                          className={`absolute top-1/2 h-2 -translate-y-1/2 rounded-full ${
                            favorsHome
                              ? "left-1/2 bg-emerald-500/80 dark:bg-emerald-400/80"
                              : "right-1/2 bg-rose-500/80 dark:bg-rose-400/80"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-12 shrink-0 text-right font-display text-[12px] font-semibold tabular-nums text-muted">
                        {c.impact > 0 ? "+" : ""}
                        {(c.impact * 100).toFixed(1)}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <p className="mt-3 text-[11px] leading-relaxed text-muted">
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
