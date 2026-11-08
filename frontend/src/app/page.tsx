"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  getGames,
  getHealth,
  getModelMetrics,
  getSeasons,
  getTeams,
  getUpcomingPredictions,
} from "@/lib/api";
import type { Game } from "@/lib/types";
import { PredictionCard } from "@/components/PredictionCard";
import { GameCard } from "@/components/GameCard";
import { GameDetailDrawer } from "@/components/GameDetailDrawer";
import { GameFilters, type GameFilterState } from "@/components/GameFilters";
import { CommandPalette } from "@/components/CommandPalette";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

type Tab = "predictions" | "browse";

const EMPTY_FILTERS: GameFilterState = {
  status: "",
  team: "",
  season: "",
  dateFrom: "",
  dateTo: "",
};

function groupByDate(games: Game[]): [string, Game[]][] {
  const map = new Map<string, Game[]>();
  for (const g of games) {
    const list = map.get(g.date) ?? [];
    list.push(g);
    map.set(g.date, list);
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

function formatDayHeading(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  const today = new Date();
  const isToday = d.toISOString().slice(0, 10) === today.toISOString().slice(0, 10);
  const label = d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  return isToday ? `Today · ${label}` : label;
}

/** Skeleton matching the real card height, so the layout does not jump. */
function PredictionSkeleton() {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 pt-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex justify-between">
        <div className="h-4 w-20 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-4 w-24 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800" />
      </div>
      <div className="mb-4 flex items-center justify-between">
        <div className="h-12 w-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-3 w-6 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-12 w-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
      </div>
      <div className="h-3.5 w-full animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800" />
      <div className="mt-4 h-3 w-32 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
    </div>
  );
}

function GameSkeleton() {
  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col gap-2">
        <div className="h-6 w-28 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-6 w-32 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
      </div>
      <div className="h-8 w-10 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
    </div>
  );
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("predictions");
  const [filters, setFilters] = useState<GameFilterState>(EMPTY_FILTERS);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
    refetchInterval: 30_000,
  });
  const teamsQuery = useQuery({ queryKey: ["teams"], queryFn: getTeams });
  const seasonsQuery = useQuery({ queryKey: ["seasons"], queryFn: getSeasons });
  const metricsQuery = useQuery({
    queryKey: ["model-metrics"],
    queryFn: getModelMetrics,
  });

  const upcomingQuery = useQuery({
    queryKey: ["upcoming-predictions"],
    queryFn: () => getUpcomingPredictions(7),
    enabled: healthQuery.isSuccess,
    refetchInterval: 60_000,
  });

  const gamesQuery = useQuery({
    queryKey: ["games", filters],
    queryFn: () =>
      getGames({
        status: filters.status || undefined,
        team: filters.team || undefined,
        season: filters.season ? Number(filters.season) : undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        limit: 120,
      }),
    enabled: healthQuery.isSuccess,
  });

  const apiState = healthQuery.isLoading
    ? "loading"
    : healthQuery.isError
      ? "error"
      : "ok";

  const grouped = useMemo(
    () => groupByDate(gamesQuery.data ?? []),
    [gamesQuery.data]
  );

  const predictions = upcomingQuery.data;
  const predictionsByDate = useMemo(() => {
    const map = new Map<string, NonNullable<typeof predictions>>();
    for (const p of predictions ?? []) {
      const list = map.get(p.game_date) ?? [];
      list.push(p);
      map.set(p.game_date, list);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }, [predictions]);

  const hasFilters =
    filters.status !== "" ||
    filters.team !== "" ||
    filters.season !== "" ||
    filters.dateFrom !== "" ||
    filters.dateTo !== "";

  const accuracy = metricsQuery.data?.accuracy;

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-4 py-10 sm:px-6 dark:bg-black">
      <motion.main
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-4xl"
      >
        <header className="mb-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                PaLaro
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                NBA game outcome predictions, powered by XGBoost.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <CommandPalette teams={teamsQuery.data ?? []} />
              <ThemeToggle />
            </div>
          </div>

          {/* Status + measured accuracy */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
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
                ? "Connecting…"
                : apiState === "ok"
                  ? `API v${healthQuery.data?.version}`
                  : "API unreachable"}
            </div>

            {accuracy != null && (
              <div
                className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                title="Accuracy on a chronological hold-out split at training time. Not a guarantee for any single game."
              >
                <span className="font-semibold tabular-nums">
                  {(accuracy * 100).toFixed(1)}%
                </span>
                <span className="text-zinc-400">hold-out accuracy</span>
              </div>
            )}
          </div>

          <div className="mt-6 flex gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
            {(
              [
                { id: "predictions", label: "Upcoming" },
                { id: "browse", label: "Browse games" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-pressed={tab === t.id}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  tab === t.id
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                    : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </header>

        {tab === "predictions" && (
          <section className="flex flex-col gap-6">
            {upcomingQuery.isLoading && (
              <div className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <PredictionSkeleton key={i} />
                ))}
              </div>
            )}

            {upcomingQuery.isError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950/30">
                <p className="text-sm text-red-600 dark:text-red-400">
                  {(upcomingQuery.error as Error).message.startsWith("API 503")
                    ? "Prediction model isn't ready yet — train it with the data pipeline first."
                    : "Failed to load upcoming predictions."}
                </p>
                <button
                  type="button"
                  onClick={() => upcomingQuery.refetch()}
                  className="mt-2 text-xs font-medium text-red-700 underline dark:text-red-300"
                >
                  Try again
                </button>
              </div>
            )}

            {upcomingQuery.isSuccess && upcomingQuery.data.length === 0 && (
              <div className="rounded-xl border border-zinc-200 bg-white px-4 py-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  No upcoming games in the next 7 days.
                </p>
                <button
                  type="button"
                  onClick={() => setTab("browse")}
                  className="mt-2 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  Browse completed games instead →
                </button>
              </div>
            )}

            {predictionsByDate.map(([date, preds]) => (
              <div key={date} className="flex flex-col gap-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  {formatDayHeading(date)}
                  <span className="ml-2 font-normal normal-case text-zinc-400">
                    {preds?.length} game{preds?.length === 1 ? "" : "s"}
                  </span>
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {preds?.map((p, i) => (
                    <PredictionCard key={p.game_id} prediction={p} index={i} />
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {tab === "browse" && (
          <section className="flex flex-col gap-5">
            <GameFilters
              value={filters}
              onChange={setFilters}
              teams={teamsQuery.data ?? []}
              seasons={seasonsQuery.data ?? []}
              resultCount={gamesQuery.data?.length}
            />

            {gamesQuery.isLoading && (
              <div className="grid gap-2 sm:grid-cols-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <GameSkeleton key={i} />
                ))}
              </div>
            )}

            {gamesQuery.isError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950/30">
                <p className="text-sm text-red-600 dark:text-red-400">
                  Failed to load games. Make sure the database is running.
                </p>
                <button
                  type="button"
                  onClick={() => gamesQuery.refetch()}
                  className="mt-2 text-xs font-medium text-red-700 underline dark:text-red-300"
                >
                  Try again
                </button>
              </div>
            )}

            {gamesQuery.isSuccess && gamesQuery.data.length === 0 && (
              <div className="rounded-xl border border-zinc-200 bg-white px-4 py-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  No games match these filters.
                </p>
                {hasFilters && (
                  <button
                    type="button"
                    onClick={() => setFilters(EMPTY_FILTERS)}
                    className="mt-2 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            )}

            {grouped.map(([date, games]) => (
              <div key={date} className="flex flex-col gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  {formatDayHeading(date)}
                </h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {games.map((g, i) => (
                    <button
                      key={g.game_id}
                      type="button"
                      onClick={() => setSelectedGame(g)}
                      className="text-left"
                    >
                      <GameCard game={g} index={i} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {teamsQuery.isSuccess && teamsQuery.data.length > 0 && (
          <footer className="mt-12 border-t border-zinc-200 pt-6 dark:border-zinc-800">
            <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Teams
            </h2>
            <div className="flex flex-wrap gap-2">
              {teamsQuery.data.map((t) => (
                <Link
                  key={t.abbr}
                  href={`/teams/${t.abbr}`}
                  className="transition-opacity hover:opacity-80"
                  title={`View ${t.name}`}
                >
                  <TeamBadge abbr={t.abbr} size="sm" />
                </Link>
              ))}
            </div>
          </footer>
        )}
      </motion.main>

      <GameDetailDrawer
        game={selectedGame}
        onClose={() => setSelectedGame(null)}
      />
    </div>
  );
}
