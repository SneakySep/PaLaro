"use client";

import Link from "next/link";
import type { UpcomingPrediction } from "@/lib/types";
import { teamColor } from "@/lib/teamColors";
import { ExplanationPanel } from "./ui/ExplanationPanel";
import { TeamBadge } from "./ui/TeamBadge";
import { WinProbabilityBar } from "./ui/WinProbabilityBar";

interface PredictionCardProps {
  prediction: UpcomingPrediction;
  /** Training timestamp from the model metrics endpoint, used for the footer. */
  trainedAt?: string | null;
}

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function parseTrainedAt(value?: string | null): Date | null {
  if (!value) return null;
  // The API returns a compact `YYYYMMDDHHMMSS` timestamp, but accept ISO too.
  if (/^\d{14}$/.test(value)) {
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(4, 6)) - 1;
    const day = Number(value.slice(6, 8));
    const hours = Number(value.slice(8, 10));
    const minutes = Number(value.slice(10, 12));
    const seconds = Number(value.slice(12, 14));
    const date = new Date(year, month, day, hours, minutes, seconds);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * A single upcoming matchup.
 *
 * The probability is the focal number; team colors are confined to a thin
 * split edge and the badges so the card still reads as neutral chrome.
 */
export function PredictionCard({ prediction, trainedAt }: PredictionCardProps) {
  const {
    home_team,
    away_team,
    home_win_prob,
    game_date,
    model_version,
    explanations,
  } = prediction;
  const home = teamColor(home_team);
  const away = teamColor(away_team);
  const favored = home_win_prob >= 0.5 ? home_team : away_team;
  const favoredColor = teamColor(favored);
  const trainedDate = parseTrainedAt(trainedAt);
  const trainedLabel = trainedDate
    ? trainedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;
  const trainedTitle = `Model ${model_version}${
    trainedDate ? ` · trained ${trainedDate.toLocaleString("en-US")}` : ""
  }`;

  return (
    <article
      aria-label={`${away.name} at ${home.name}`}
      className="panel panel-hover relative overflow-hidden"
    >
      {/* Team-colored edge, so a card is identifiable before reading it. */}
      <div
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{
          background: `linear-gradient(to right, ${home.primary} 0%, ${home.primary} 50%, ${away.primary} 50%, ${away.primary} 100%)`,
        }}
        aria-hidden="true"
      />

      <div className="p-5 pt-[1.4rem]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted">
            {formatDate(game_date)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-muted/60 px-2.5 py-1 text-[11px] font-medium text-muted">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: favoredColor.primary }}
              aria-hidden="true"
            />
            <span className="font-semibold text-ink">{favored}</span>
            favored
          </span>
        </div>

        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-start gap-3">
          <Link
            href={`/teams/${home_team}`}
            className="group/team flex min-w-0 flex-col items-start gap-2 rounded-lg"
            aria-label={`View ${home.name}`}
          >
            <span className="inline-flex rounded-[11px] transition-transform duration-200 group-hover/team:-translate-y-0.5">
              <TeamBadge abbr={home_team} size="lg" />
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="truncate text-[15px] font-semibold leading-tight text-ink">
                {home.name}
              </span>
              <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted">
                Home
              </span>
            </span>
          </Link>

          <span className="pt-4 text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted">
            vs
          </span>

          <Link
            href={`/teams/${away_team}`}
            className="group/team flex min-w-0 flex-col items-end gap-2 rounded-lg text-right"
            aria-label={`View ${away.name}`}
          >
            <span className="inline-flex rounded-[11px] transition-transform duration-200 group-hover/team:-translate-y-0.5">
              <TeamBadge abbr={away_team} size="lg" />
            </span>
            <span className="flex min-w-0 flex-col items-end gap-1">
              <span className="truncate text-[15px] font-semibold leading-tight text-ink">
                {away.name}
              </span>
              <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted">
                Away
              </span>
            </span>
          </Link>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              Win probability
            </span>
          </div>
          <WinProbabilityBar
            homeProb={home_win_prob}
            homeTeam={home_team}
            awayTeam={away_team}
          />
        </div>

        <ExplanationPanel
          contributions={explanations}
          homeTeam={home_team}
          awayTeam={away_team}
        />

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
          <span className="text-[11px] text-muted">Model forecast</span>
          <span
            className="inline-flex items-center gap-1.5 truncate text-[11px] text-muted"
            title={trainedTitle}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v5M12 8h.01" />
            </svg>
            {trainedLabel ? `Updated ${trainedLabel}` : "Model details"}
          </span>
        </div>
      </div>
    </article>
  );
}
