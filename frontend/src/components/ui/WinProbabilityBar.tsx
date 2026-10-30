import { motion } from "framer-motion";

interface WinProbabilityBarProps {
  /** 0..1 */
  homeProb: number;
  homeTeam: string;
  awayTeam: string;
}

/**
 * Minimal, animated split bar visualizing home vs away win probability.
 * The home slice animates to `homeProb` on mount — a fast, clean startup motion.
 */
export function WinProbabilityBar({
  homeProb,
  homeTeam,
  awayTeam,
}: WinProbabilityBarProps) {
  const pct = Math.round(homeProb * 100);
  const awayProb = 1 - homeProb;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-sm font-medium text-zinc-500">
        <span className="uppercase tracking-wide">{homeTeam}</span>
        <span className="uppercase tracking-wide">{awayTeam}</span>
      </div>
      <div className="relative mt-2 h-3 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        {/* Away slice (background) */}
        <motion.div
          className="absolute inset-0 bg-zinc-400/60 dark:bg-zinc-700"
          initial={{ scaleX: 1 }}
        />
        {/* Home slice (foreground, grows left->right) */}
        <motion.div
          className="absolute inset-y-0 left-0 origin-left rounded-l-full bg-emerald-500 dark:bg-emerald-400"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: homeProb }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 flex items-center justify-between text-xs text-zinc-400">
        <span>{pct}%</span>
        <span>{Math.round(awayProb * 100)}%</span>
      </div>
    </div>
  );
}
