import { motion } from "framer-motion";
import type { Game } from "@/lib/types";

interface GameCardProps {
  game: Game;
  index?: number;
}

export function GameCard({ game, index = 0 }: GameCardProps) {
  const isFinal = game.status === "final";
  const homeWon = isFinal && (game.home_points ?? 0) > (game.away_points ?? 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-5 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex items-center gap-3">
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          {new Date(game.date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </span>
        <span
          className={`text-sm font-medium ${homeWon
              ? "text-zinc-900 dark:text-zinc-50"
              : "text-zinc-600 dark:text-zinc-300"
            }`}
        >
          {game.home_team}
        </span>
        <span className="text-xs text-zinc-400">vs</span>
        <span
          className={`text-sm font-medium ${!homeWon && isFinal
              ? "text-zinc-900 dark:text-zinc-50"
              : "text-zinc-600 dark:text-zinc-300"
            }`}
        >
          {game.away_team}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {isFinal && game.home_points != null && game.away_points != null ? (
          <span className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
            {game.home_points} – {game.away_points}
          </span>
        ) : (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            {game.status}
          </span>
        )}
      </div>
    </motion.div>
  );
}
