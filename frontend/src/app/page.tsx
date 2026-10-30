"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getHealth } from "@/lib/api";
import type { HealthResponse, PredictionResponse } from "@/lib/types";
import { PredictionCard } from "@/components/PredictionCard";

// Demo payload — will be replaced by /api/v1/predict once the ML model is live.
const DEMO_PREDICTIONS: PredictionResponse[] = [
  {
    game_id: "demo-1",
    home_team: "BOS",
    away_team: "LAL",
    home_win_prob: 0.62,
    confidence_interval: [0.54, 0.7],
    model_version: "0.1.0",
  },
];

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [apiState, setApiState] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    getHealth()
      .then((h) => {
        setHealth(h);
        setApiState("ok");
      })
      .catch(() => setApiState("error"));
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <motion.main
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-3xl"
      >
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            PaLaro
          </h1>
          <p className="mt-2 text-zinc-500 dark:text-zinc-400">
            NBA game outcome predictions, powered by XGBoost.
          </p>

          {/* Backend connection status */}
          <div
            className={`mx-auto mt-6 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
              apiState === "ok"
                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                : apiState === "error"
                ? "bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400"
                : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                apiState === "loading"
                  ? "animate-pulse bg-zinc-400"
                  : apiState === "ok"
                  ? "bg-emerald-500"
                  : "bg-red-500"
              }`}
            />
            {apiState === "loading"
              ? "Connecting to API…"
              : apiState === "ok"
              ? `API connected · v${health?.version}`
              : "API unreachable — is the backend running on :8000?"}
          </div>
        </header>

        {/* Predictions */}
        <section className="grid gap-4">
          {DEMO_PREDICTIONS.map((p, i) => (
            <PredictionCard key={p.game_id} prediction={p} index={i} />
          ))}
        </section>
      </motion.main>
    </div>
  );
}
