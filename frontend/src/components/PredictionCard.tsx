import { motion } from "framer-motion";
import type { PredictionResponse } from "@/lib/types";
import { WinProbabilityBar } from "./ui/WinProbabilityBar";

interface PredictionCardProps {
  prediction: PredictionResponse;
  index?: number;
}

export function PredictionCard({ prediction, index = 0 }: PredictionCardProps) {
  const [lower, upper] = prediction.confidence_interval ?? [0, 0];

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
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {prediction.model_version}
        </span>
      </div>

      <WinProbabilityBar
        homeProb={prediction.home_win_prob}
        homeTeam={prediction.home_team}
        awayTeam={prediction.away_team}
      />

      {/* Confidence interval */}
      <div className="mt-4 flex items-center gap-2 border-t border-zinc-100 pt-3 text-xs text-zinc-500 dark:border-zinc-800">
        <span>Confidence</span>
        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <motion.div
            className="absolute inset-y-0 rounded-full bg-emerald-500/70 dark:bg-emerald-400/70"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 }}
            style={{
              left: `${lower * 100}%`,
              width: `${(upper - lower) * 100}%`,
              transformOrigin: "left",
            }}
          />
        </div>
        <span>
          {Math.round(lower * 100)}–{Math.round(upper * 100)}%
        </span>
      </div>
    </motion.article>
  );
}
