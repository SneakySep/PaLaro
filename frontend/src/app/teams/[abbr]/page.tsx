"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ApiError, getTeamDetail } from "@/lib/api";
import type { FormBucket } from "@/lib/types";
import { readableOn, teamColor } from "@/lib/teamColors";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

type SeasonSelection = number | "all";

function winPct(bucket: FormBucket): string {
  if (bucket.games === 0) return "—";
  return `${Math.round(bucket.win_rate * 100)}%`;
}

function StatCell({
  label,
  bucket,
  accent,
}: {
  label: string;
  bucket: FormBucket;
  accent: string;
}) {
  return (
    <div className="bg-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
          {label}
        </p>
        <p className="font-display text-[11px] font-semibold tabular-nums text-muted">
          {winPct(bucket)}
        </p>
      </div>
      <p className="mt-1.5 font-display text-[28px] font-semibold leading-none tracking-[-0.01em] tabular-nums text-ink">
        {bucket.wins}
        <span className="mx-1 text-muted">–</span>
        {bucket.losses}
      </p>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{
            width: `${Math.round(bucket.win_rate * 100)}%`,
            backgroundColor: accent,
          }}
        />
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted">
        {bucket.games > 0
          ? `${bucket.pts_for} for · ${bucket.pts_against} against`
          : "No games played"}
      </p>
      {bucket.games > 0 && (
        <p className="text-[11px] font-medium text-muted">
          <span className="text-ink">
            {bucket.margin > 0 ? "+" : ""}
            {bucket.margin}
          </span>{" "}
          margin
        </p>
      )}
    </div>
  );
}

export default function TeamPage({
  params,
}: {
  params: Promise<{ abbr: string }>;
}) {
  return (
    <Suspense fallback={<TeamPageSkeleton />}>
      <TeamDetailView params={params} />
    </Suspense>
  );
}

function PageFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex flex-1 flex-col bg-canvas">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden">
        <div className="court-lines" />
      </div>
      <div className="relative flex flex-1 flex-col items-center px-4 pb-16 pt-6 sm:px-8 sm:pt-8">
        <div className="w-full max-w-[1440px]">{children}</div>
      </div>
    </div>
  );
}

function TopBar({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-line pb-4">
      <div className="flex items-baseline gap-4">
        <Link
          href="/"
          className="font-display text-[26px] font-semibold leading-none tracking-[-0.01em] text-ink"
          aria-label="PaLaro home"
        >
          PaLaro
        </Link>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-[11.5px] font-medium text-muted transition-colors hover:text-ink"
        >
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
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {backLabel}
        </Link>
      </div>
      <ThemeToggle />
    </header>
  );
}

function TeamPageSkeleton() {
  return (
    <PageFrame>
      <div role="status" aria-label="Loading team" aria-busy="true">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="skeleton h-7 w-24 rounded-md" />
          <div className="skeleton h-10 w-10 rounded-[10px]" />
        </div>
        <div className="pt-8">
          <div className="skeleton h-[196px] w-full rounded-[20px]" />
          <div className="mt-5 flex items-center justify-between">
            <div className="skeleton h-4 w-40 rounded" />
            <div className="skeleton h-9 w-32 rounded-[10px]" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-[18px] border border-line bg-line sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-surface p-4">
                <div className="skeleton h-2.5 w-12 rounded" />
                <div className="skeleton mt-2 h-7 w-16 rounded" />
                <div className="skeleton mt-3 h-1.5 w-full rounded-full" />
                <div className="skeleton mt-2 h-2.5 w-24 rounded" />
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="panel overflow-hidden">
                <div className="border-b border-line px-4 py-3">
                  <div className="skeleton h-4 w-28 rounded" />
                </div>
                <div className="flex flex-col gap-2 p-3">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <div
                      key={j}
                      className="skeleton h-9 w-full rounded-[10px]"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageFrame>
  );
}

function TeamDetailView({
  params,
}: {
  params: Promise<{ abbr: string }>;
}) {
  const { abbr } = use(params);
  const code = abbr.toUpperCase();
  const color = teamColor(code);
  const onColor = readableOn(color.primary);

  // ``null`` means "use the team's latest season", which the API resolves.
  const [season, setSeason] = useState<SeasonSelection | null>(null);
  const allSeasons = season === "all";
  const selectedSeason = typeof season === "number" ? season : undefined;

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ["team", code, season ?? "latest"],
    queryFn: () => getTeamDetail(code, selectedSeason, allSeasons),
    placeholderData: keepPreviousData,
  });

  if (isLoading) {
    return <TeamPageSkeleton />;
  }

  if (isError || !data) {
    const message =
      error instanceof ApiError && error.status === 404
        ? "We couldn't find that team."
        : "We couldn't load this team right now.";
    return (
      <PageFrame>
        <TopBar backHref="/?tab=browse" backLabel="All games" />
        <div className="panel mt-8 flex flex-col items-center gap-3 p-10 text-center">
          <p className="text-[13px] text-muted">{message}</p>
          <Link
            href="/?tab=browse"
            className="text-link text-[12px]"
          >
            Back to games
          </Link>
        </div>
      </PageFrame>
    );
  }

  const displayedSeason =
    season === "all"
      ? "all"
      : season != null
        ? String(season)
        : data.season != null
          ? String(data.season)
          : "";

  const seasonLabel =
    displayedSeason && displayedSeason !== "all"
      ? `${displayedSeason}-${String(Number(displayedSeason) + 1).slice(2)}`
      : "All seasons";

  return (
    <PageFrame>
      <TopBar backHref="/?tab=browse" backLabel="All games" />

      <motion.main
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="pt-8"
      >
        <header
          className="relative overflow-hidden rounded-[20px] p-6 ring-1 ring-black/10 sm:p-7 dark:ring-white/15"
          style={{ backgroundColor: color.primary, color: onColor }}
        >
          <span
            className="pointer-events-none absolute -right-2 top-1/2 -translate-y-1/2 select-none font-display text-[180px] font-semibold leading-none opacity-[0.09]"
            aria-hidden="true"
          >
            {data.abbr}
          </span>

          <div className="relative flex flex-wrap items-end justify-between gap-6">
            <div className="flex min-w-0 items-start gap-4">
              <span className="hidden shrink-0 sm:inline-flex">
                <TeamBadge abbr={data.abbr} size="lg" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-75">
                  {[data.conference, data.division].filter(Boolean).join(" · ") ||
                    "NBA"}
                </p>
                <h1 className="mt-2 font-display text-[40px] font-semibold leading-[0.95] tracking-[-0.015em] sm:text-[48px]">
                  {data.name}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] font-medium opacity-85">
                  <span>{seasonLabel}</span>
                  {data.streak && (
                    <span>
                      Streak{" "}
                      <span className="font-display text-[14px] font-semibold tabular-nums">
                        {data.streak}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">
                Record
              </p>
              <p className="mt-1 font-display text-[46px] font-semibold leading-none tracking-[-0.01em] tabular-nums">
                {data.overall.wins}
                <span className="mx-1 opacity-50">–</span>
                {data.overall.losses}
              </p>
              <p className="mt-1 text-[11px] font-medium opacity-75">
                {winPct(data.overall)} win rate
              </p>
            </div>
          </div>
        </header>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <h2 className="font-display text-[18px] font-semibold tracking-[-0.01em] text-ink">
              Season form
            </h2>
            <span className="text-[11px] text-muted">
              {isFetching ? "Updating…" : seasonLabel}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="team-season" className="sr-only">
              Season
            </label>
            <select
              id="team-season"
              value={displayedSeason}
              onChange={(e) => {
                const value = e.target.value;
                if (value === "all") setSeason("all");
                else if (value) setSeason(Number(value));
                else setSeason(null);
              }}
              className="control select-control"
            >
              {data.seasons.length === 0 && (
                <option value="">No seasons</option>
              )}
              {data.seasons.length > 0 && <option value="all">All seasons</option>}
              {data.seasons.map((s) => (
                <option key={s} value={String(s)}>
                  {s}-{String(s + 1).slice(2)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <section
          aria-label="Season record"
          className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-[18px] border border-line bg-line shadow-[var(--panel-shadow)] sm:grid-cols-4"
        >
          <StatCell label="Overall" bucket={data.overall} accent={color.primary} />
          <StatCell label="Home" bucket={data.home} accent={color.primary} />
          <StatCell label="Away" bucket={data.away} accent={color.primary} />
          <StatCell label="Last 10" bucket={data.last10} accent={color.primary} />
        </section>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <section className="panel overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
              <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">
                Recent results
              </h2>
              <span className="font-display text-[12px] font-semibold tabular-nums text-muted">
                {data.recent.length}
              </span>
            </div>

            {data.recent.length === 0 ? (
              <p className="px-4 py-6 text-[12.5px] text-muted">
                No completed games.
              </p>
            ) : (
              <div className="divide-y divide-line">
                {data.recent.map((g) => {
                  const opp = g.is_home ? g.away_team : g.home_team;
                  const ptsFor = g.is_home ? g.home_points : g.away_points;
                  const ptsAgainst = g.is_home ? g.away_points : g.home_points;
                  return (
                    <div
                      key={g.game_id}
                      className="flex items-center justify-between gap-2 px-4 py-2.5 transition-colors hover:bg-surface-muted/40"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          className={`font-display flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] text-[11px] font-semibold ${
                            g.won
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                              : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400"
                          }`}
                          aria-label={g.won ? "Win" : "Loss"}
                        >
                          {g.won ? "W" : "L"}
                        </span>
                        <span className="text-[11px] text-muted">
                          {g.is_home ? "vs" : "@"}
                        </span>
                        <Link
                          href={`/teams/${opp}`}
                          aria-label={`View ${opp}`}
                          className="rounded"
                        >
                          <TeamBadge abbr={opp} size="sm" />
                        </Link>
                        <span className="min-w-0 truncate text-[12.5px] font-medium text-ink">
                          {teamColor(opp).name}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-[11px] text-muted">
                          {new Date(`${g.date}T12:00:00Z`).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric" }
                          )}
                        </span>
                        <span className="min-w-14 text-right font-display text-[15px] font-semibold tabular-nums text-ink">
                          {ptsFor != null && ptsAgainst != null
                            ? `${ptsFor}–${ptsAgainst}`
                            : "—"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="panel overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
              <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">
                Upcoming
              </h2>
              <span className="font-display text-[12px] font-semibold tabular-nums text-muted">
                {data.upcoming.length}
              </span>
            </div>

            {data.upcoming.length === 0 ? (
              <p className="px-4 py-6 text-[12.5px] text-muted">
                No scheduled games.
              </p>
            ) : (
              <div className="divide-y divide-line">
                {data.upcoming.map((g) => {
                  const opp = g.is_home ? g.away_team : g.home_team;
                  return (
                    <div
                      key={g.game_id}
                      className="flex items-center justify-between gap-2 px-4 py-2.5 transition-colors hover:bg-surface-muted/40"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="text-[11px] text-muted">
                          {g.is_home ? "vs" : "@"}
                        </span>
                        <Link
                          href={`/teams/${opp}`}
                          aria-label={`View ${opp}`}
                          className="rounded"
                        >
                          <TeamBadge abbr={opp} size="sm" />
                        </Link>
                        <span className="min-w-0 truncate text-[12.5px] font-medium text-ink">
                          {teamColor(opp).name}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted">
                        {new Date(`${g.date}T12:00:00Z`).toLocaleDateString(
                          "en-US",
                          { weekday: "short", month: "short", day: "numeric" }
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </motion.main>
    </PageFrame>
  );
}
