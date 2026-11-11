"use client";

import { motion } from "framer-motion";
import { teamColor } from "@/lib/teamColors";

interface WinProbabilityBarProps {
  /** 0..1 */
  homeProb: number;
  homeTeam: string;
  awayTeam: string;
}

/**
 * Split bar showing each team's win probability in its own brand color.
 *
 * The percentages sit above the bar in the display face so the number, not
 * the color, is the first thing read. The bar animates width only, which is
 * what the layout uses.
 */
export function WinProbabilityBar({
  homeProb,
  homeTeam,
  awayTeam,
}: WinProbabilityBarProps) {
  const clamped = Math.min(Math.max(homeProb, 0), 1);
  const homePct = Math.round(clamped * 100);
  const awayPct = 100 - homePct;

  const home = teamColor(homeTeam);
  const away = teamColor(awayTeam);

  return (
    <div className="w-full">
      <div className="flex items-end justify-between gap-4">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="font-display text-[30px] font-semibold leading-none tracking-[-0.01em] tabular-nums text-ink">
            {homePct}
            <span className="ml-0.5 text-[16px] font-medium text-muted">%</span>
          </span>
          <span className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
            {homeTeam}
          </span>
        </div>
        <div className="flex min-w-0 flex-row-reverse items-baseline gap-2 text-right">
          <span className="font-display text-[30px] font-semibold leading-none tracking-[-0.01em] tabular-nums text-ink">
            {awayPct}
            <span className="ml-0.5 text-[16px] font-medium text-muted">%</span>
          </span>
          <span className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
            {awayTeam}
          </span>
        </div>
      </div>

      <div
        className="relative mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-surface-muted"
        role="img"
        aria-label={`${homeTeam} ${homePct} percent, ${awayTeam} ${awayPct} percent`}
      >
        <motion.div
          style={{ backgroundColor: home.primary }}
          initial={{ width: "50%" }}
          animate={{ width: `${homePct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
        <motion.div
          className="flex-1"
          style={{ backgroundColor: away.primary }}
          initial={{ opacity: 0.85 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        />
      </div>
    </div>
  );
}
