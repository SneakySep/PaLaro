"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ApiError,
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

const PAGE_SIZE = 50;

const EMPTY_FILTERS: GameFilterState = {
  status: "",
  team: "",
  season: "",
  dateFrom: "",
  dateTo: "",
};

function parseStatus(value: string | null): GameFilterState["status"] {
  return value === "scheduled" || value === "final" ? value : "";
}

function groupByDate(games: Game[]): [string, Game[]][] {
  const map = new Map<string, Game[]>();
  for (const g of games) {
    const list = map.get(g.date) ?? [];
    list.push(g);
    map.set(g.date, list);
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return new Date(iso);
  return new Date(year, month - 1, day, 12);
}

function localIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDayLabel(iso: string): { primary: string; secondary: string } {
  const d = parseIsoDate(iso);
  const isToday = iso === localIsoDate(new Date());
  const sameYear = d.getFullYear() === new Date().getFullYear();

  if (isToday) {
    return {
      primary: "Today",
      secondary: d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
    };
  }

  return {
    primary: d.toLocaleDateString("en-US", { weekday: "long" }),
    secondary: d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      ...(sameYear ? {} : { year: "numeric" }),
    }),
  };
}

function DateHeading({ iso, count }: { iso: string; count: number }) {
  const { primary, secondary } = formatDayLabel(iso);
  const isToday = primary === "Today";

  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`h-3.5 w-[3px] rounded-full ${
          isToday ? "bg-signal" : "bg-line-strong"
        }`}
        aria-hidden="true"
      />
      <h2 className="font-display text-[17px] font-semibold leading-none tracking-[-0.01em] text-ink">
        {primary}
      </h2>
      <span className="text-[12px] text-muted">{secondary}</span>
      <span className="ml-auto text-[11px] font-medium tabular-nums text-muted">
        {count} {count === 1 ? "game" : "games"}
      </span>
    </div>
  );
}

function StatusPill({
  state,
  version,
}: {
  state: "loading" | "error" | "ok";
  version?: string;
}) {
  const styles =
    state === "ok"
      ? "border-emerald-200/80 bg-emerald-50/80 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
      : state === "error"
        ? "border-red-200/80 bg-red-50/80 text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
        : "border-line bg-surface-muted/60 text-muted";

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${styles}`}
      title={state === "ok" ? `API v${version}` : undefined}
    >
      <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
        {state === "ok" && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        )}
        <span
          className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
            state === "ok"
              ? "bg-emerald-500"
              : state === "error"
                ? "bg-red-500"
                : "bg-muted"
          }`}
        />
      </span>
      {state === "loading" ? "Connecting" : state === "ok" ? "Live" : "Offline"}
    </div>
  );
}

function SlateStat({
  label,
  value,
  title,
}: {
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <div className="bg-surface px-4 py-3.5" title={title}>
      <p className="whitespace-nowrap text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted sm:text-[11px] sm:tracking-[0.14em]">
        {label}
      </p>
      <p className="mt-1.5 font-display text-[28px] font-semibold leading-none tracking-[-0.01em] tabular-nums text-ink xl:text-[32px]">
        {value}
      </p>
    </div>
  );
}

/** Skeleton matching the real card height, so the layout does not jump. */
function PredictionSkeleton() {
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between">
        <div className="skeleton h-3 w-16 rounded-full" />
        <div className="skeleton h-5 w-24 rounded-full" />
      </div>
      <div className="mt-5 flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <div className="skeleton h-14 w-14 rounded-[12px]" />
          <div className="skeleton h-3 w-16 rounded" />
          <div className="skeleton h-2.5 w-9 rounded" />
        </div>
        <div className="skeleton h-3 w-5 rounded" />
        <div className="flex flex-col items-end gap-2">
          <div className="skeleton h-14 w-14 rounded-[12px]" />
          <div className="skeleton h-3 w-16 rounded" />
          <div className="skeleton h-2.5 w-9 rounded" />
        </div>
      </div>
      <div className="mt-5">
        <div className="skeleton h-2.5 w-24 rounded" />
        <div className="skeleton mt-2.5 h-2.5 w-full rounded-full" />
      </div>
      <div className="skeleton mt-4 h-3 w-28 rounded" />
      <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
        <div className="skeleton h-2.5 w-24 rounded" />
        <div className="skeleton h-2.5 w-20 rounded" />
      </div>
    </div>
  );
}

function GameSkeleton() {
  return (
    <div className="panel flex items-center justify-between px-4 py-3">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="skeleton h-7 w-7 rounded-[7px]" />
          <div className="skeleton h-3.5 w-24 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <div className="skeleton h-7 w-7 rounded-[7px]" />
          <div className="skeleton h-3.5 w-28 rounded" />
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <div className="skeleton h-2.5 w-12 rounded" />
        <div className="skeleton h-8 w-10 rounded" />
      </div>
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="relative flex flex-1 flex-col bg-canvas">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[500px] overflow-hidden">
        <div className="court-lines" />
      </div>
      <div className="relative flex flex-1 flex-col items-center px-4 pb-16 pt-6 sm:px-8 sm:pt-8">
        <div
          className="w-full max-w-[1440px]"
          role="status"
          aria-label="Loading dashboard"
          aria-busy="true"
        >
          <div className="flex items-center justify-between border-b border-line pb-4">
            <div className="skeleton h-7 w-24 rounded-md" />
            <div className="flex items-center gap-2">
              <div className="skeleton h-9 w-20 rounded-full" />
              <div className="skeleton h-9 w-28 rounded-[10px]" />
              <div className="skeleton h-9 w-9 rounded-[10px]" />
            </div>
          </div>
          <div className="pt-8">
            <div className="skeleton h-3 w-24 rounded" />
            <div className="skeleton mt-3 h-11 w-64 rounded-lg" />
            <div className="skeleton mt-3 h-4 w-72 rounded" />
            <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[18px] border border-line bg-line sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-surface px-4 py-3.5">
                  <div className="skeleton h-2.5 w-16 rounded" />
                  <div className="skeleton mt-2 h-7 w-14 rounded" />
                </div>
              ))}
            </div>
            <div className="skeleton mt-6 h-11 w-full rounded-[12px] sm:w-80" />
            <div className="mt-7 flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div className="skeleton h-4 w-36 rounded" />
                <div className="skeleton h-3 w-12 rounded" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <PredictionSkeleton key={i} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  const tab: Tab =
    searchParams.get("tab") === "browse" ? "browse" : "predictions";

  const filters = useMemo<GameFilterState>(
    () => ({
      status: parseStatus(searchParams.get("status")),
      team: searchParams.get("team") ?? "",
      season: searchParams.get("season") ?? "",
      dateFrom: searchParams.get("from") ?? "",
      dateTo: searchParams.get("to") ?? "",
    }),
    [searchParams]
  );

  const offset = Math.max(0, Number(searchParams.get("offset") ?? "0") || 0);

  const updateParams = useCallback(
    (patch: Record<string, string | number | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, String(value));
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const setTab = (next: Tab) => {
    updateParams({ tab: next === "browse" ? "browse" : null });
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  };

  const setFilters = useCallback(
    (next: GameFilterState) => {
      updateParams({
        status: next.status || null,
        team: next.team || null,
        season: next.season || null,
        from: next.dateFrom || null,
        to: next.dateTo || null,
        offset: null,
      });
    },
    [updateParams]
  );

  const goToOffset = (next: number) => {
    updateParams({ offset: next > 0 ? next : null });
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  };

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
    refetchInterval: 60_000,
  });

  const gamesQuery = useQuery({
    queryKey: ["games", filters, offset],
    queryFn: () =>
      getGames({
        status: filters.status || undefined,
        team: filters.team || undefined,
        season: filters.season ? Number(filters.season) : undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        limit: PAGE_SIZE,
        offset,
      }),
    placeholderData: keepPreviousData,
  });

  const apiState = healthQuery.isLoading
    ? "loading"
    : healthQuery.isError
      ? "error"
      : "ok";

  const games = gamesQuery.data?.games;
  const totalGames = gamesQuery.data?.total;
  const grouped = useMemo(() => groupByDate(games ?? []), [games]);

  const gameCount = games?.length ?? 0;
  const showingFrom = gameCount > 0 ? offset + 1 : 0;
  const showingTo = Math.min(offset + gameCount, totalGames ?? 0);
  const canGoBack = offset > 0;
  const canGoForward =
    totalGames != null && offset + gameCount < totalGames;

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

  const todayCount =
    predictions?.filter((p) => p.game_date === localIsoDate(new Date())).length ??
    null;
  const upcomingCount = predictions?.length ?? null;
  const accuracy = metricsQuery.data?.accuracy;
  const accuracyLabel =
    accuracy != null ? `${(accuracy * 100).toFixed(1)}%` : "—";

  const hasFilters =
    filters.status !== "" ||
    filters.team !== "" ||
    filters.season !== "" ||
    filters.dateFrom !== "" ||
    filters.dateTo !== "";

  const pageTitle =
    tab === "predictions" ? "Tonight's slate" : "Game archive";
  const pageSubtitle =
    tab === "predictions"
      ? upcomingCount != null
        ? `${upcomingCount} games across the next 7 days.`
        : "Scoring the next seven days."
      : hasFilters && totalGames != null
        ? `${totalGames.toLocaleString()} games match the current filters.`
        : totalGames != null
          ? `${totalGames.toLocaleString()} games across ${
              seasonsQuery.data?.length ?? 0
            } seasons.`
          : "Every game in the archive.";

  return (
    <div className="relative flex flex-1 flex-col bg-canvas">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[500px] overflow-hidden">
        <div className="court-lines" />
      </div>

      <div className="relative flex flex-1 flex-col items-center px-4 pb-16 pt-6 sm:px-8 sm:pt-8">
        <div className="w-full max-w-[1440px]">
          <header className="flex items-center justify-between gap-4 border-b border-line pb-4">
            <div className="flex items-center gap-5">
              <Link
                href="/"
                className="group flex items-baseline gap-2.5 rounded"
                aria-label="PaLaro home"
              >
                <span className="font-display text-[26px] font-semibold leading-none tracking-[-0.01em] text-ink">
                  PaLaro
                </span>
                <span className="hidden text-[11px] font-medium text-muted transition-colors group-hover:text-ink sm:inline">
                  NBA predictions
                </span>
              </Link>
              <Link
                href="/teams"
                className="hidden rounded text-[11.5px] font-medium text-muted transition-colors hover:text-ink sm:inline"
              >
                Teams
              </Link>
            </div>

            <div className="flex items-center gap-2">
              <StatusPill
                state={apiState}
                version={healthQuery.data?.version}
              />
              <CommandPalette teams={teamsQuery.data ?? []} />
              <ThemeToggle />
            </div>
          </header>

          <motion.main
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="pt-8"
          >
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="text-[11px] font-medium text-muted">
                  {tab === "predictions"
                    ? "Next 7 days"
                    : "All seasons, newest first"}
                </p>
                <h1 className="mt-1.5 font-display text-[40px] font-semibold leading-[0.98] tracking-[-0.015em] text-ink sm:text-[46px] xl:text-[52px]">
                  {pageTitle}
                </h1>
                <p className="mt-2 max-w-xl text-[13px] leading-6 text-muted">
                  {pageSubtitle}
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[18px] border border-line bg-line shadow-[var(--panel-shadow)] sm:grid-cols-4">
              <SlateStat
                label="Next 7 days"
                value={upcomingCount != null ? String(upcomingCount) : "—"}
              />
              <SlateStat
                label="Today"
                value={todayCount != null ? String(todayCount) : "—"}
              />
              <SlateStat
                label={hasFilters ? "Matching" : "Games"}
                value={totalGames != null ? totalGames.toLocaleString() : "—"}
                title="Games in the archive."
              />
              <SlateStat
                label="Accuracy"
                value={accuracyLabel}
                title="Model accuracy on a chronological hold-out split at training time. Not a guarantee for any single game."
              />
            </div>

            <div className="sticky top-0 z-30 -mx-4 mt-3 bg-canvas/90 px-4 py-3 backdrop-blur-md sm:-mx-8 sm:px-8">
              <div
                role="tablist"
                aria-label="Dashboard view"
                className="flex w-full gap-1 rounded-[12px] border border-line bg-surface-muted/70 p-1 sm:w-fit"
              >
              {(
                [
                  {
                    id: "predictions",
                    label: "Upcoming",
                    count: upcomingCount,
                  },
                  {
                    id: "browse",
                    label: "Browse games",
                    count: totalGames ?? null,
                  },
                ] as const
              ).map((t) => {
                const selected = tab === t.id;
                return (
                  <button
                    key={t.id}
                    id={`${t.id}-tab`}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls={`${t.id}-panel`}
                    onClick={() => setTab(t.id)}
                    className={`relative flex min-h-9 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[9px] px-2 text-[12px] font-medium transition-colors sm:flex-none sm:gap-2 sm:px-3.5 sm:text-[12.5px] ${
                      selected ? "text-ink" : "text-muted hover:text-ink"
                    }`}
                  >
                    {selected && (
                      <motion.span
                        layoutId="tab-pill"
                        className="absolute inset-0 rounded-[9px] border border-line bg-surface shadow-[0_1px_2px_rgb(21_23_20/0.06)]"
                        transition={{
                          type: "spring",
                          stiffness: 420,
                          damping: 34,
                        }}
                      />
                    )}
                    <span className="relative z-10">{t.label}</span>
                    {t.count != null && (
                      <span
                        className={`relative z-10 font-display text-[11.5px] font-semibold tabular-nums sm:text-[12px] ${
                          selected ? "text-signal" : "text-muted"
                        }`}
                      >
                        {t.count.toLocaleString()}
                      </span>
                    )}
                  </button>
                );
              })}
              </div>
            </div>

            {tab === "predictions" && (
              <section
                id="predictions-panel"
                role="tabpanel"
                aria-labelledby="predictions-tab"
                aria-busy={upcomingQuery.isLoading}
                className="mt-7 flex flex-col gap-7"
              >
                {upcomingQuery.isLoading && (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <PredictionSkeleton key={i} />
                    ))}
                  </div>
                )}

                {upcomingQuery.isError && (
                  <div className="rounded-[16px] border border-red-200/80 bg-red-50/70 p-4 dark:border-red-500/20 dark:bg-red-500/5">
                    <p className="text-[13px] font-medium text-red-800 dark:text-red-300">
                      {upcomingQuery.error instanceof ApiError &&
                      upcomingQuery.error.status === 503
                        ? "Predictions are temporarily unavailable while the model loads."
                        : "We couldn't load upcoming predictions. Try again in a moment."}
                    </p>
                    <button
                      type="button"
                      onClick={() => upcomingQuery.refetch()}
                      className="mt-2 text-[12px] font-medium text-red-800 underline underline-offset-3 dark:text-red-300"
                    >
                      Try again
                    </button>
                  </div>
                )}

                {upcomingQuery.isSuccess &&
                  upcomingQuery.data.length === 0 && (
                    <div className="panel p-6 text-center">
                      <p className="text-[13px] text-muted">
                        No games in the next 7 days.
                      </p>
                      <button
                        type="button"
                        onClick={() => setTab("browse")}
                        className="text-link mt-2 text-[12px]"
                      >
                        Browse the archive
                      </button>
                    </div>
                  )}

                {predictionsByDate.map(([date, preds]) => (
                  <div key={date} className="flex flex-col gap-3">
                    <DateHeading iso={date} count={preds.length} />
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {preds.map((p) => (
                        <PredictionCard
                          key={p.game_id}
                          prediction={p}
                          trainedAt={metricsQuery.data?.trained_at}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            )}

            {tab === "browse" && (
              <section
                id="browse-panel"
                role="tabpanel"
                aria-labelledby="browse-tab"
                aria-busy={gamesQuery.isLoading}
                className="mt-7"
              >
                {(teamsQuery.isError || seasonsQuery.isError) && (
                  <div className="mb-5 rounded-[14px] border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-[12.5px] text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/5 dark:text-amber-300">
                    Some filter options couldn&apos;t load. You can still browse
                    games with the filters that are available.
                  </div>
                )}

                <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)] xl:items-start">
                  <div className="min-w-0 xl:sticky xl:top-[78px] xl:max-h-[calc(100vh-5.5rem)] xl:overflow-y-auto">
                    <GameFilters
                      value={filters}
                      onChange={setFilters}
                      teams={teamsQuery.data ?? []}
                      seasons={seasonsQuery.data ?? []}
                      resultCount={totalGames}
                      isFetching={gamesQuery.isFetching}
                    />
                  </div>

                  <div className="flex min-w-0 flex-col gap-5">
                    {gamesQuery.isLoading && (
                      <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
                        {Array.from({ length: 9 }).map((_, i) => (
                          <GameSkeleton key={i} />
                        ))}
                      </div>
                    )}

                {gamesQuery.isError && (
                  <div className="rounded-[16px] border border-red-200/80 bg-red-50/70 p-4 dark:border-red-500/20 dark:bg-red-500/5">
                    <p className="text-[13px] font-medium text-red-800 dark:text-red-300">
                      We couldn&apos;t load games. Check your connection and try
                      again.
                    </p>
                    <button
                      type="button"
                      onClick={() => gamesQuery.refetch()}
                      className="mt-2 text-[12px] font-medium text-red-800 underline underline-offset-3 dark:text-red-300"
                    >
                      Try again
                    </button>
                  </div>
                )}

                {gamesQuery.isSuccess && gameCount === 0 && (
                  <div className="panel p-6 text-center">
                    <p className="text-[13px] text-muted">
                      No games match these filters.
                    </p>
                    {hasFilters && (
                      <button
                        type="button"
                        onClick={() => setFilters(EMPTY_FILTERS)}
                        className="text-link mt-2 text-[12px]"
                      >
                        Clear all filters
                      </button>
                    )}
                    {!hasFilters && offset > 0 && (
                      <button
                        type="button"
                        onClick={() => goToOffset(0)}
                        className="text-link mt-2 text-[12px]"
                      >
                        Back to the first page
                      </button>
                    )}
                  </div>
                )}

                {grouped.map(([date, dateGames]) => (
                  <div key={date} className="flex flex-col gap-2.5">
                    <DateHeading iso={date} count={dateGames.length} />
                    <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
                      {dateGames.map((g) => (
                        <button
                          key={g.game_id}
                          type="button"
                          onClick={() => setSelectedGame(g)}
                          aria-haspopup="dialog"
                          aria-expanded={selectedGame?.game_id === g.game_id}
                          className="block w-full cursor-pointer rounded-[12px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                        >
                          <GameCard game={g} />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {gamesQuery.isSuccess &&
                  totalGames != null &&
                  totalGames > 0 && (
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-line bg-surface px-3.5 py-3">
                      <p className="text-[11.5px] text-muted">
                        Showing{" "}
                        <span className="font-display text-[13px] font-semibold tabular-nums text-ink">
                          {showingFrom}–{showingTo}
                        </span>{" "}
                        of{" "}
                        <span className="font-display text-[13px] font-semibold tabular-nums text-ink">
                          {totalGames.toLocaleString()}
                        </span>{" "}
                        games
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            goToOffset(Math.max(0, offset - PAGE_SIZE))
                          }
                          disabled={!canGoBack || gamesQuery.isFetching}
                          className="btn"
                        >
                          <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M15 18l-6-6 6-6" />
                          </svg>
                          Previous
                        </button>
                        <button
                          type="button"
                          onClick={() => goToOffset(offset + PAGE_SIZE)}
                          disabled={!canGoForward || gamesQuery.isFetching}
                          className="btn"
                        >
                          Next
                          <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M9 18l6-6-6-6" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                  </div>
                </div>
              </section>
            )}

            {teamsQuery.isSuccess && teamsQuery.data.length > 0 && (
              <footer className="mt-12 border-t border-line pt-6">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                    Teams
                  </h2>
                  <Link
                    href="/teams"
                    className="inline-flex items-center gap-1 text-[11.5px] font-medium text-muted transition-colors hover:text-ink"
                  >
                    All {teamsQuery.data.length} teams
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </Link>
                </div>
                <div className="flex flex-wrap gap-1">
                  {teamsQuery.data.map((t) => (
                    <Link
                      key={t.abbr}
                      href={`/teams/${t.abbr}`}
                      aria-label={`View ${t.name}`}
                      className="rounded-[9px] p-0.5 transition-colors hover:bg-surface-muted"
                      title={`View ${t.name}`}
                    >
                      <TeamBadge abbr={t.abbr} size="md" />
                    </Link>
                  ))}
                </div>
                <p className="mt-4 text-[11px] text-muted/80">
                  Team logos are property of their respective NBA teams.
                </p>
              </footer>
            )}
          </motion.main>
        </div>
      </div>

      <GameDetailDrawer
        game={selectedGame}
        onClose={() => setSelectedGame(null)}
      />
    </div>
  );
}
