"use client";

import { motion } from "framer-motion";
import type { UpcomingPrediction } from "@/lib/types";
import { teamColor } from "@/lib/teamColors";
import { TeamBadge } from "./ui/TeamBadge";
import { WinProbabilityBar } from "./ui/WinProbabilityBar";

interface PredictionCardProps {
  prediction: UpcomingPrediction;
  index?: number;
}

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function PredictionCard({ prediction, index = 0 }: PredictionCardProps) {
  const { home_team, away_team, home_win_prob, game_date, model_version } =
    prediction;
  const home = teamColor(home_team);
  const away = teamColor(away_team);
  const favored = home_win_prob >= 0.5 ? home_team : away_team;
  const favoredColor = teamColor(favored);

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
    >
      {/* Team-colored edge, so a card is identifiable before reading it. */}
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{
          background: `linear-gradient(to right, ${home.primary} 0%, ${home.primary} 50%, ${away.primary} 50%, ${away.primary} 100%)`,
        }}
      />

      <div className="p-5 pt-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {formatDate(game_date)}
          </span>
          <span
            className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{
              backgroundColor: `${favoredColor.primary}1a`,
              color: favoredColor.primary,
            }}
          >
            {favored} favored
          </span>
        </div>

        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-col items-start gap-1.5">
            <TeamBadge abbr={home_team} size="lg" />
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {home.name}
            </span>
          </div>

          <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">
            vs
          </span>

          <div className="flex min-w-0 flex-col items-end gap-1.5">
            <TeamBadge abbr={away_team} size="lg" />
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {away.name}
            </span>
          </div>
        </div>

        <WinProbabilityBar
          homeProb={home_win_prob}
          homeTeam={home_team}
          awayTeam={away_team}
        />

        <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <span className="text-[10px] text-zinc-400">Home win probability</span>
          <span className="font-mono text-[10px] text-zinc-400">
            {model_version}
          </span>
        </div>
      </div>
    </motion.article>
  );
}
