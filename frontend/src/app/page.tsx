"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { getGames, getHealth, getUpcomingPredictions } from "@/lib/api";
import { PredictionCard } from "@/components/PredictionCard";
import { GameCard } from "@/components/GameCard";

export default function Home() {
  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
    refetchInterval: 30_000,
  });

  const gamesQuery = useQuery({
    queryKey: ["games"],
    queryFn: () => getGames(),
    enabled: healthQuery.isSuccess,
  });

  const upcomingQuery = useQuery({
    queryKey: ["upcoming-predictions"],
    queryFn: () => getUpcomingPredictions(7),
    enabled: healthQuery.isSuccess,
    refetchInterval: 60_000,
  });

  const apiState = healthQuery.isLoading
    ? "loading"
    : healthQuery.isError
      ? "error"
      : "ok";

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
            className={`mx-auto mt-6 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${apiState === "ok"
                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                : apiState === "error"
                  ? "bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400"
                  : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
              }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${apiState === "loading"
                  ? "animate-pulse bg-zinc-400"
                  : apiState === "ok"
                    ? "bg-emerald-500"
                    : "bg-red-500"
                }`}
            />
            {apiState === "loading"
              ? "Connecting to API…"
              : apiState === "ok"
                ? `API connected · v${healthQuery.data?.version}`
                : "API unreachable — is the backend running on :8000?"}
          </div>
        </header>

        {/* Upcoming game predictions */}
        <section className="grid gap-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Upcoming Games
          </h2>

          {upcomingQuery.isLoading &&
            Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="h-36 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
              />
            ))}

          {upcomingQuery.isError && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
              {(upcomingQuery.error as Error).message.startsWith("API 503")
                ? "Prediction model isn't ready yet — train it with the data pipeline first."
                : "Failed to load upcoming predictions."}
            </p>
          )}

          {upcomingQuery.isSuccess && upcomingQuery.data.length === 0 && (
            <p className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              No upcoming games in the next 7 days. Run the scoreboard sync to
              populate the schedule.
            </p>
          )}

          {upcomingQuery.isSuccess &&
            upcomingQuery.data.map((p, i) => (
              <PredictionCard key={p.game_id} prediction={p} index={i} />
            ))}
        </section>

        {/* Recent games from the database */}
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Recent Games
          </h2>

          {gamesQuery.isLoading && (
            <div className="grid gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
                />
              ))}
            </div>
          )}

          {gamesQuery.isError && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
              Failed to load games. Make sure the database is running and has
              been ingested.
            </p>
          )}

          {gamesQuery.isSuccess && gamesQuery.data.length === 0 && (
            <p className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              No games in the database yet. Run the ingestion script to
              populate historical data.
            </p>
          )}

          {gamesQuery.isSuccess && gamesQuery.data.length > 0 && (
            <div className="grid gap-3">
              {gamesQuery.data.map((game, i) => (
                <GameCard key={game.game_id} game={game} index={i} />
              ))}
            </div>
          )}
        </section>
      </motion.main>
    </div>
  );
}
