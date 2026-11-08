"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Game } from "@/lib/types";
import { teamColor } from "@/lib/teamColors";
import { TeamBadge } from "./ui/TeamBadge";

interface GameDetailDrawerProps {
  game: Game | null;
  onClose: () => void;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-100 py-2 text-sm last:border-0 dark:border-zinc-800">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-50">
        {value}
      </span>
    </div>
  );
}

/**
 * Slide-over with a single game's detail.
 *
 * Closes on Escape and on backdrop click, and traps nothing — it is a
 * non-modal panel, so the list behind stays scrollable.
 */
export function GameDetailDrawer({ game, onClose }: GameDetailDrawerProps) {
  useEffect(() => {
    if (!game) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game, onClose]);

  const home = game ? teamColor(game.home_team) : null;
  const away = game ? teamColor(game.away_team) : null;
  const hasScore = game?.home_points != null && game?.away_points != null;
  const homeWon = hasScore && game!.home_points! > game!.away_points!;
  const awayWon = hasScore && game!.away_points! > game!.home_points!;

  return (
    <AnimatePresence>
      {game && home && away && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.aside
            role="dialog"
            aria-label={`${game.away_team} at ${game.home_team}`}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl dark:bg-zinc-900"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            <div
              className="h-1.5 w-full shrink-0"
              style={{
                background: `linear-gradient(to right, ${away.primary} 0%, ${away.primary} 50%, ${home.primary} 50%, ${home.primary} 100%)`,
              }}
            />

            <div className="flex items-start justify-between p-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  {new Date(`${game.date}T12:00:00Z`).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
                <h2 className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">
                  {away.name} at {home.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex items-center justify-center gap-8 px-5 pb-6">
              <div className="flex flex-col items-center gap-2">
                <TeamBadge abbr={game.away_team} size="lg" />
                <span className="text-xs text-zinc-500">{away.name}</span>
              </div>
              <span className="text-xs font-medium uppercase tracking-widest text-zinc-300 dark:text-zinc-600">
                at
              </span>
              <div className="flex flex-col items-center gap-2">
                <TeamBadge abbr={game.home_team} size="lg" />
                <span className="text-xs text-zinc-500">{home.name}</span>
              </div>
            </div>

            <div className="px-5 pb-8">
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Result
              </h3>
              <div className="rounded-xl border border-zinc-200 px-4 dark:border-zinc-800">
                <Row label="Status" value={game.status} />
                {hasScore ? (
                  <>
                    <Row
                      label={`${game.away_team} score`}
                      value={
                        <span className={awayWon ? "font-bold" : ""}>
                          {game.away_points}
                        </span>
                      }
                    />
                    <Row
                      label={`${game.home_team} score`}
                      value={
                        <span className={homeWon ? "font-bold" : ""}>
                          {game.home_points}
                        </span>
                      }
                    />
                    <Row
                      label="Margin"
                      value={`${Math.abs(game.home_points! - game.away_points!)} pts`}
                    />
                    <Row
                      label="Winner"
                      value={homeWon ? home.name : away.name}
                    />
                  </>
                ) : (
                  <Row label="Score" value="Not played yet" />
                )}
                {game.season != null && (
                  <Row
                    label="Season"
                    value={`${game.season}-${String(game.season + 1).slice(2)}`}
                  />
                )}
                <Row
                  label="Game ID"
                  value={
                    <span className="font-mono text-xs text-zinc-500">
                      {game.game_id}
                    </span>
                  }
                />
              </div>

              <p className="mt-4 text-xs leading-relaxed text-zinc-400">
                Feature-level explanations are not exposed by the API yet. The
                prediction for a scheduled game comes from each team&apos;s
                trailing 5-game form, rest days, and shooting efficiency.
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
