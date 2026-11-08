"use client";

import { motion } from "framer-motion";
import type { Game } from "@/lib/types";
import { teamColor } from "@/lib/teamColors";
import { TeamBadge } from "./ui/TeamBadge";

interface GameCardProps {
  game: Game;
  index?: number;
}

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * A completed or scheduled game row.
 *
 * Winner is marked with a colored left edge and bolder score rather than only
 * a text-color change, so it survives dark mode and color-blind viewing.
 */
export function GameCard({ game, index = 0 }: GameCardProps) {
  const isFinal = game.status === "final";
  const hasScore = game.home_points != null && game.away_points != null;
  const homeWon = isFinal && hasScore && game.home_points! > game.away_points!;
  const awayWon = isFinal && hasScore && game.away_points! > game.home_points!;

  const home = teamColor(game.home_team);
  const away = teamColor(game.away_team);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 12) * 0.03 }}
      className="relative overflow-hidden rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center gap-2">
            <TeamBadge abbr={game.away_team} size="sm" />
            <span
              className={`truncate text-sm ${
                awayWon
                  ? "font-bold text-zinc-900 dark:text-zinc-50"
                  : "font-medium text-zinc-600 dark:text-zinc-300"
              }`}
            >
              {away.name}
            </span>
            {awayWon && (
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: away.primary }}
                aria-label="won"
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            <TeamBadge abbr={game.home_team} size="sm" />
            <span
              className={`truncate text-sm ${
                homeWon
                  ? "font-bold text-zinc-900 dark:text-zinc-50"
                  : "font-medium text-zinc-600 dark:text-zinc-300"
              }`}
            >
              {home.name}
            </span>
            {homeWon && (
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: home.primary }}
                aria-label="won"
              />
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="text-[10px] uppercase tracking-wide text-zinc-400">
            {formatDate(game.date)}
          </span>
          {hasScore ? (
            <div className="flex flex-col items-end gap-0.5 tabular-nums">
              <span
                className={`text-sm ${
                  awayWon
                    ? "font-bold text-zinc-900 dark:text-zinc-50"
                    : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                {game.away_points}
              </span>
              <span
                className={`text-sm ${
                  homeWon
                    ? "font-bold text-zinc-900 dark:text-zinc-50"
                    : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                {game.home_points}
              </span>
            </div>
          ) : (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              {game.status}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
