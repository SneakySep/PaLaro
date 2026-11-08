"use client";

import { motion } from "framer-motion";
import { readableOn, teamColor } from "@/lib/teamColors";

interface WinProbabilityBarProps {
  /** 0..1 */
  homeProb: number;
  homeTeam: string;
  awayTeam: string;
  /** Compact variant for dense lists. */
  size?: "sm" | "md";
}

/**
 * Split bar showing each team's win probability in its own brand color.
 *
 * The previous version set both `scaleX` and `width` on the same element, so
 * the animation and the layout disagreed and the bar could render at the wrong
 * length. This version animates `width` only, which is what the layout uses.
 */
export function WinProbabilityBar({
  homeProb,
  homeTeam,
  awayTeam,
  size = "md",
}: WinProbabilityBarProps) {
  const clamped = Math.min(Math.max(homeProb, 0), 1);
  const homePct = Math.round(clamped * 100);
  const awayPct = 100 - homePct;

  const home = teamColor(homeTeam);
  const away = teamColor(awayTeam);
  const homeFg = readableOn(home.primary);
  const awayFg = readableOn(away.primary);

  const height = size === "sm" ? "h-2" : "h-3.5";
  // Below ~18% the label cannot fit inside its slice; the percentage row below
  // always carries the number, so hiding it here loses nothing.
  const showInlineLabels = homePct >= 18 && awayPct >= 18;

  return (
    <div className="w-full">
      <div
        className={`relative flex w-full overflow-hidden rounded-full ${height}`}
        role="img"
        aria-label={`${homeTeam} ${homePct} percent, ${awayTeam} ${awayPct} percent`}
      >
        <motion.div
          className="flex items-center justify-start pl-2"
          style={{ backgroundColor: home.primary }}
          initial={{ width: "50%" }}
          animate={{ width: `${homePct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {showInlineLabels && (
            <span
              className="text-[10px] font-bold tabular-nums"
              style={{ color: homeFg }}
            >
              {homePct}%
            </span>
          )}
        </motion.div>
        <motion.div
          className="flex flex-1 items-center justify-end pr-2"
          style={{ backgroundColor: away.primary }}
          initial={{ opacity: 0.9 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          {showInlineLabels && (
            <span
              className="text-[10px] font-bold tabular-nums"
              style={{ color: awayFg }}
            >
              {awayPct}%
            </span>
          )}
        </motion.div>
      </div>

      <div className="mt-1.5 flex items-center justify-between text-xs">
        <span className="font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">
          {homePct}%
        </span>
        <span className="font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">
          {awayPct}%
        </span>
      </div>
    </div>
  );
}
