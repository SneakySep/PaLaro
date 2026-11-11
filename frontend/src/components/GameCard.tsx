"use client";

import type { Game } from "@/lib/types";
import { teamColor } from "@/lib/teamColors";
import { TeamBadge } from "./ui/TeamBadge";

interface GameCardProps {
  game: Game;
}

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function TeamRow({
  abbr,
  name,
  won,
  points,
  showScore,
}: {
  abbr: string;
  name: string;
  won: boolean;
  points: number | null;
  showScore: boolean;
}) {
  const color = teamColor(abbr);

  return (
    <div className="flex items-center gap-2">
      <TeamBadge abbr={abbr} size="sm" />
      <span
        className={`truncate text-[13px] ${
          won
            ? "font-semibold text-ink"
            : "font-medium text-muted"
        }`}
      >
        {name}
      </span>
      {won && (
        <>
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: color.primary }}
            aria-hidden="true"
          />
          <span className="sr-only">Winner</span>
        </>
      )}
      {showScore && (
        <span
          className={`ml-auto shrink-0 font-display text-[16px] leading-none tabular-nums ${
            won ? "font-semibold text-ink" : "text-muted"
          }`}
        >
          {points}
        </span>
      )}
    </div>
  );
}

/**
 * A completed or scheduled game row.
 *
 * The winner is marked with a card-edge bar in its brand color plus a bolder
 * score, so it survives dark mode and color-blind viewing.
 */
export function GameCard({ game }: GameCardProps) {
  const isFinal = game.status === "final";
  const hasScore = game.home_points != null && game.away_points != null;
  const homeWon = isFinal && hasScore && game.home_points! > game.away_points!;
  const awayWon = isFinal && hasScore && game.away_points! > game.home_points!;

  const home = teamColor(game.home_team);
  const away = teamColor(game.away_team);
  const winnerColor = homeWon ? home.primary : awayWon ? away.primary : null;

  return (
    <div className="relative overflow-hidden rounded-[12px] border border-line bg-surface px-3.5 py-3 transition-colors group-hover:border-line-strong group-hover:bg-surface-muted/40">
      {winnerColor && (
        <span
          className="absolute inset-y-2.5 left-0 w-[2.5px] rounded-full"
          style={{ backgroundColor: winnerColor }}
          aria-hidden="true"
        />
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <TeamRow
            abbr={game.away_team}
            name={away.name}
            won={awayWon}
            points={game.away_points}
            showScore={hasScore}
          />
          <TeamRow
            abbr={game.home_team}
            name={home.name}
            won={homeWon}
            points={game.home_points}
            showScore={hasScore}
          />
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted">
            {formatDate(game.date)}
          </span>
          {!hasScore && (
            <span className="rounded-full border border-line bg-surface-muted/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted">
              {game.status}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
