"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { Game } from "@/lib/types";
import { teamColor } from "@/lib/teamColors";
import { useDialog } from "@/lib/useDialog";
import { TeamBadge } from "./ui/TeamBadge";

interface GameDetailDrawerProps {
  game: Game | null;
  onClose: () => void;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3.5 py-2.5 text-[12px]">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium tabular-nums text-ink">
        {value}
      </span>
    </div>
  );
}

function formatStatus(status: string): string {
  if (status === "final") return "Final";
  if (status === "scheduled") return "Scheduled";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * Slide-over with a single game's detail.
 *
 * It is a true modal: Escape and the backdrop close it, focus is trapped
 * inside, and the page behind cannot scroll while it is open.
 */
export function GameDetailDrawer({ game, onClose }: GameDetailDrawerProps) {
  const dialogRef = useDialog<HTMLElement>(Boolean(game), onClose);

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
            className="fixed inset-0 z-40 cursor-pointer bg-black/35 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.aside
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="game-detail-title"
            tabIndex={-1}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto border-l border-line bg-surface shadow-[-24px_0_70px_-40px_rgb(21_23_20/0.45)] outline-none sm:rounded-l-[20px]"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 340 }}
          >
            <div
              className="h-1 w-full shrink-0 sm:rounded-tl-[20px]"
              style={{
                background: `linear-gradient(to right, ${away.primary} 0%, ${away.primary} 50%, ${home.primary} 50%, ${home.primary} 100%)`,
              }}
              aria-hidden="true"
            />

            <div className="flex items-start justify-between gap-4 px-5 pb-5 pt-4">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
                  {new Date(`${game.date}T12:00:00Z`).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
                <h2
                  id="game-detail-title"
                  className="mt-1.5 font-display text-[24px] font-semibold leading-[1.05] tracking-[-0.01em] text-ink"
                >
                  {away.name} at {home.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] border border-line bg-surface text-muted transition-colors hover:border-line-strong hover:bg-surface-muted hover:text-ink"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 pb-6">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-[16px] border border-line bg-surface-muted/40 p-4">
                <div className="flex min-w-0 flex-col items-center gap-2 text-center">
                  <TeamBadge abbr={game.away_team} size="lg" />
                  <span className="w-full truncate text-[13px] font-medium text-ink">
                    {away.name}
                  </span>
                  {hasScore && (
                    <span
                      className={`font-display text-[34px] leading-none tabular-nums ${
                        awayWon
                          ? "font-semibold text-ink"
                          : "font-medium text-muted"
                      }`}
                    >
                      {game.away_points}
                    </span>
                  )}
                </div>
                <span className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                  at
                </span>
                <div className="flex min-w-0 flex-col items-center gap-2 text-center">
                  <TeamBadge abbr={game.home_team} size="lg" />
                  <span className="w-full truncate text-[13px] font-medium text-ink">
                    {home.name}
                  </span>
                  {hasScore && (
                    <span
                      className={`font-display text-[34px] leading-none tabular-nums ${
                        homeWon
                          ? "font-semibold text-ink"
                          : "font-medium text-muted"
                      }`}
                    >
                      {game.home_points}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="px-5 pb-8">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                Game ledger
              </h3>
              <div className="divide-y divide-line rounded-[14px] border border-line bg-surface">
                <Row
                  label="Status"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      {!hasScore && game.status === "scheduled" && (
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-signal"
                          aria-hidden="true"
                        />
                      )}
                      {formatStatus(game.status)}
                    </span>
                  }
                />
                {hasScore ? (
                  <>
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
                    <span className="font-mono text-[11px] text-muted">
                      {game.game_id}
                    </span>
                  }
                />
              </div>

              <p className="mt-4 text-[11.5px] leading-relaxed text-muted">
                Upcoming predictions on the dashboard include a feature-level
                breakdown of trailing form, rest days, and shooting efficiency.
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
