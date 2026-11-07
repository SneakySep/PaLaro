import { motion } from "framer-motion";
import type { UpcomingPrediction } from "@/lib/types";
import { WinProbabilityBar } from "./ui/WinProbabilityBar";

interface PredictionCardProps {
  prediction: UpcomingPrediction;
  index?: number;
}

export function PredictionCard({ prediction, index = 0 }: PredictionCardProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          {prediction.home_team} <span className="text-zinc-400">vs</span>{" "}
          {prediction.away_team}
        </h3>
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
            {new Date(`${prediction.game_date}T12:00:00Z`).toLocaleDateString(
              "en-US",
              { weekday: "short", month: "short", day: "numeric" }
            )}
          </span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            {prediction.model_version}
          </span>
        </div>
      </div>

      <WinProbabilityBar
        homeProb={prediction.home_win_prob}
        homeTeam={prediction.home_team}
        awayTeam={prediction.away_team}
      />
    </motion.article>
  );
}
